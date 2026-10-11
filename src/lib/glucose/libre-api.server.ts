import { z } from "zod";
import type { LibreCandidate, LibreErrorCode } from "./libre-contract";
import { normalizeLibreGraph } from "./libre-normalize";

const HOSTS: Record<string, string> = {
  LA: "api-la.libreview.io",
  US: "api-us.libreview.io",
  EU: "api-eu.libreview.io",
  EU2: "api-eu2.libreview.io",
  DE: "api-de.libreview.io",
  FR: "api-fr.libreview.io",
  CA: "api-ca.libreview.io",
  AU: "api-au.libreview.io",
  AP: "api-ap.libreview.io",
  AE: "api-ae.libreview.io",
  JP: "api-jp.libreview.io",
  RU: "api.libreview.ru",
  CN: "api-cn.myfreestyle.cn",
};
export class LibreFailure extends Error {
  constructor(public readonly code: LibreErrorCode) {
    super(code);
  }
}
export interface LibreTicket {
  token: string;
  account: string;
  expires: number;
  region: string;
}

export class LibreApi {
  constructor(
    private readonly transport: typeof fetch = fetch,
    private readonly version = "4.16.0",
  ) {}

  private async request(region: string, path: string, ticket?: LibreTicket, body?: unknown) {
    if (!HOSTS[region]) throw new LibreFailure("format");
    try {
      const response = await this.transport(`https://${HOSTS[region]}${path}`, {
        method: body ? "POST" : "GET",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          version: this.version,
          product: "llu.ios",
          ...(ticket
            ? { Authorization: `Bearer ${ticket.token}`, "account-id": ticket.account }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 429) throw new LibreFailure("throttled");
      if (response.status === 401) throw new LibreFailure(ticket ? "expired" : "credentials");
      if (!response.ok) throw new LibreFailure("unavailable");
      const raw: unknown = await response.json();
      const parsed = z.object({ status: z.number(), data: z.unknown() }).safeParse(raw);
      if (!parsed.success) throw new LibreFailure("format");
      if (parsed.data.status === 429) throw new LibreFailure("throttled");
      if (parsed.data.status === 4) throw new LibreFailure("account");
      if (parsed.data.status !== 0) throw new LibreFailure(ticket ? "expired" : "credentials");
      return parsed.data.data;
    } catch (error) {
      if (error instanceof LibreFailure) throw error;
      throw new LibreFailure("unavailable");
    }
  }

  async login(email: string, password: string, region: string): Promise<LibreTicket> {
    for (let redirects = 0; redirects < 3; redirects++) {
      const data = await this.request(region, "/llu/auth/login", undefined, { email, password });
      const redirected = z
        .object({ redirect: z.literal(true), region: z.string() })
        .safeParse(data);
      if (redirected.success) {
        const next = redirected.data.region.toUpperCase();
        if (!HOSTS[next] || next === region) throw new LibreFailure("format");
        region = next;
        continue;
      }
      const parsed = z
        .object({
          user: z.object({ id: z.string().min(1) }),
          authTicket: z.object({
            token: z.string().min(1),
            expires: z.number().finite().positive(),
          }),
        })
        .safeParse(data);
      if (!parsed.success) throw new LibreFailure("format");
      if (parsed.data.authTicket.expires * 1000 <= Date.now()) throw new LibreFailure("expired");
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(parsed.data.user.id),
      );
      return {
        token: parsed.data.authTicket.token,
        expires: parsed.data.authTicket.expires,
        region,
        account: [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, "0")).join(""),
      };
    }
    throw new LibreFailure("format");
  }
  async candidates(ticket: LibreTicket): Promise<LibreCandidate[]> {
    const parsed = z
      .array(
        z.object({
          patientId: z.string().min(1).max(128),
          firstName: z.string().max(200),
          lastName: z.string().max(200),
        }),
      )
      .max(100)
      .safeParse(await this.request(ticket.region, "/llu/connections", ticket));
    if (!parsed.success) throw new LibreFailure("format");
    return parsed.data.map((c) => ({
      id: c.patientId,
      name: `${c.firstName} ${c.lastName}`.trim() || "Sem nome",
    }));
  }
  async graph(ticket: LibreTicket, selected: string) {
    const data = await this.request(
      ticket.region,
      `/llu/connections/${encodeURIComponent(selected)}/graph`,
      ticket,
    );
    try {
      return normalizeLibreGraph(data, selected);
    } catch (error) {
      throw new LibreFailure(
        error instanceof Error && error.message === "selection" ? "selection" : "format",
      );
    }
  }
}
