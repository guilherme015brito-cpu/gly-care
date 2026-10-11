import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { LibreApi, LibreFailure, type LibreTicket } from "./libre-api.server";
import { openLibre, sealLibre } from "./libre-crypto.server";
import { LibreLinkUpProvider } from "./providers";
import {
  LIBRE_ERRORS,
  type LibreRequest,
  type LibreResult,
  type LibreStatus,
  type LibreErrorCode,
} from "./libre-contract";

const ticketSchema = z.object({
  token: z.string().min(1),
  account: z.string().regex(/^[a-f0-9]{64}$/),
  expires: z.number().finite(),
  region: z.string(),
});
function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new LibreFailure("setup");
  return result.data;
}

export async function handleLibre(
  input: LibreRequest,
  userId: string,
  auth: SupabaseClient<Database>,
): Promise<LibreResult> {
  try {
    const member = check(
      await auth
        .from("patient_members")
        .select("role")
        .eq("patient_id", input.pid)
        .eq("user_id", userId)
        .maybeSingle(),
    );
    if (!member) throw new LibreFailure("permission");
    if (!["status", "sync"].includes(input.action) && member.role === "professional_readonly")
      throw new LibreFailure("permission");
    const secret = process.env["LIBRE_TOKEN_KEY"] ?? "";
    const adminKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!/^[a-f0-9]{64}$/i.test(secret) || !adminKey || !url) {
      if (input.action === "status")
        return {
          status: {
            ready: false,
            connected: false,
            expired: false,
            name: null,
            lastSync: null,
            error: LIBRE_ERRORS.setup,
            setupIssue: "server_configuration",
          },
        };
      throw new LibreFailure("setup");
    }
    // Dedicated ungenerated schema: only this server module accesses the private
    // integration tables. The browser's typed client never receives their rows.
    const db = createClient(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rowResult = await db
      .from("libre_connections")
      .select("*")
      .eq("patient_id", input.pid)
      .maybeSingle();
    if (rowResult.error) {
      if (input.action === "status")
        return {
          status: {
            ready: false,
            connected: false,
            expired: false,
            name: null,
            lastSync: null,
            error: LIBRE_ERRORS.setup,
            setupIssue: "database_schema",
          },
        };
      throw new LibreFailure("setup");
    }
    const row = rowResult.data as {
      revision: string;
      connected_by: string;
      libre_patient_id: string;
      display_name: string;
      sealed_ticket: string | null;
      expires_at: string | null;
      last_sync_at: string | null;
      next_attempt_at: string;
      last_error_code: LibreErrorCode | null;
    } | null;
    const status = (): LibreStatus => ({
      ready: true,
      connected: !!row?.sealed_ticket,
      expired:
        !!row?.sealed_ticket &&
        (new Date(row.expires_at ?? 0).getTime() <= Date.now() ||
          row.last_error_code === "expired"),
      name: row?.display_name ?? null,
      lastSync: row?.last_sync_at ?? null,
      error: row?.last_error_code
        ? (LIBRE_ERRORS[row.last_error_code] ?? LIBRE_ERRORS.unavailable)
        : null,
    });
    if (input.action === "status") return { status: status() };
    const api = new LibreApi(fetch, process.env["LIBRE_CLIENT_VERSION"] || "4.16.0");
    const decrypt = async (sealed: string, scope: string): Promise<LibreTicket> => {
      try {
        const ticket = ticketSchema.parse(await openLibre(sealed, secret, scope));
        if (ticket.expires * 1000 <= Date.now()) throw new Error("expired");
        return ticket;
      } catch {
        throw new LibreFailure("expired");
      }
    };
    if (input.action === "login") {
      if (!check(await db.rpc("claim_libre_login", { p_user: userId })))
        throw new LibreFailure("retry");
      const ticket = await api.login(input.email, input.password, input.region);
      const candidates = await api.candidates(ticket);
      if (!candidates.length) throw new LibreFailure("selection");
      const draft = crypto.randomUUID();
      const sealed = await sealLibre(ticket, secret, `draft:${input.pid}:${userId}:${draft}`);
      check(await db.from("libre_drafts").delete().lt("expires_at", new Date().toISOString()));
      check(
        await db.from("libre_drafts").upsert(
          {
            id: draft,
            patient_id: input.pid,
            user_id: userId,
            sealed_ticket: sealed,
            expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
          },
          { onConflict: "user_id,patient_id" },
        ),
      );
      return { draft, candidates };
    }
    if (input.action === "select") {
      const draft = check(
        await db
          .from("libre_drafts")
          .select("sealed_ticket")
          .eq("id", input.draft)
          .eq("patient_id", input.pid)
          .eq("user_id", userId)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle(),
      );
      if (!draft) throw new LibreFailure("expired");
      const ticket = await decrypt(
        draft.sealed_ticket,
        `draft:${input.pid}:${userId}:${input.draft}`,
      );
      const candidate = (await api.candidates(ticket)).find((c) => c.id === input.connection);
      if (!candidate || (row && row.libre_patient_id !== candidate.id))
        throw new LibreFailure("selection");
      // Validate remote identity and readings before changing the active connection.
      const readings = await api.graph(ticket, candidate.id);
      const result = await db.rpc("activate_libre", {
        p_patient: input.pid,
        p_user: userId,
        p_draft: input.draft,
        p_libre: candidate.id,
        p_name: candidate.name,
        p_ticket: await sealLibre(ticket, secret, `connection:${input.pid}`),
        p_expires: new Date(
          Math.min(ticket.expires * 1000, Date.now() + 7 * 86400000),
        ).toISOString(),
        p_readings: readings,
      });
      const inserted = check(result) as number;
      return { inserted };
    }
    if (input.action === "disconnect") {
      check(
        await db
          .from("libre_connections")
          .update({
            sealed_ticket: null,
            expires_at: null,
            revision: crypto.randomUUID(),
            last_error_code: null,
          })
          .eq("patient_id", input.pid),
      );
      check(await db.from("libre_drafts").delete().eq("patient_id", input.pid));
      return {};
    }
    if (!row?.sealed_ticket) return { inserted: 0 };
    if (status().expired) throw new LibreFailure("expired");
    // Stop ingestion if the person who authorized this connection lost access.
    const owner = check(
      await db
        .from("patient_members")
        .select("role")
        .eq("patient_id", input.pid)
        .eq("user_id", row.connected_by)
        .maybeSingle(),
    );
    if (!owner || owner.role === "professional_readonly") throw new LibreFailure("permission");
    const claimed = check(
      await db
        .from("libre_connections")
        .update({ next_attempt_at: new Date(Date.now() + 60000).toISOString() })
        .eq("patient_id", input.pid)
        .eq("revision", row.revision)
        .lte("next_attempt_at", new Date().toISOString())
        .select("revision"),
    );
    if (!claimed?.length) return { inserted: 0 };
    try {
      const ticket = await decrypt(row.sealed_ticket, `connection:${input.pid}`);
      const candidates = await api.candidates(ticket);
      if (!candidates.some((c) => c.id === row.libre_patient_id))
        throw new LibreFailure("selection");
      const provider = new LibreLinkUpProvider(async (since) =>
        (await api.graph(ticket, row.libre_patient_id)).filter(
          (r) => new Date(r.measured_at) >= since,
        ),
      );
      const readings = await provider.fetchSince(new Date(Date.now() - 24 * 3600000));
      return {
        inserted: check(
          await db.rpc("ingest_libre_readings", {
            p_patient: input.pid,
            p_revision: row.revision,
            p_readings: readings,
          }),
        ) as number,
      };
    } catch (error) {
      const code = error instanceof LibreFailure ? error.code : "unavailable";
      check(
        await db
          .from("libre_connections")
          .update({
            last_error_code: code,
            next_attempt_at: new Date(
              Date.now() + (code === "throttled" ? 15 : 5) * 60000,
            ).toISOString(),
          })
          .eq("patient_id", input.pid)
          .eq("revision", row.revision),
      );
      throw error;
    }
  } catch (error) {
    // Never propagate upstream response bodies, tokens, credentials or raw errors.
    return { error: LIBRE_ERRORS[error instanceof LibreFailure ? error.code : "unavailable"] };
  }
}
