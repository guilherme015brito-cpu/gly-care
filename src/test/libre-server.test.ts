// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LibreRequest } from "@/lib/glucose/libre-contract";
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  login: vi.fn(),
  candidates: vi.fn(),
  graph: vi.fn(),
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/glucose/libre-crypto.server", () => ({
  openLibre: mocks.decrypt,
  sealLibre: mocks.encrypt,
}));
vi.mock("@/lib/glucose/libre-api.server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/glucose/libre-api.server")>();
  return {
    ...original,
    LibreApi: class {
      login = mocks.login;
      candidates = mocks.candidates;
      graph = mocks.graph;
    },
  };
});
import { handleLibre } from "@/lib/glucose/libre.server";
const pid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = "invented-user";
const request: LibreRequest = {
  action: "login",
  pid,
  email: "fake@example.test",
  password: "invented-password",
  region: "LA",
  consent: true,
};
function query(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(),
    delete: vi.fn(),
    lt: vi.fn(),
    upsert: vi.fn(),
    then: vi.fn(),
  };
  for (const name of [
    "select",
    "eq",
    "maybeSingle",
    "update",
    "lte",
    "gt",
    "delete",
    "lt",
    "upsert",
  ] as const)
    builder[name].mockReturnValue(builder);
  builder.then.mockImplementation((resolve) => Promise.resolve(resolve({ data, error })));
  return builder;
}
function auth(role: string | null) {
  return {
    from: vi.fn().mockReturnValue(query(role ? { role } : null)),
  } as unknown as SupabaseClient<Database>;
}
function database(rows: unknown[]) {
  const db = { from: vi.fn(), rpc: vi.fn() };
  for (const row of rows) db.from.mockReturnValueOnce(query(row));
  mocks.createClient.mockReturnValue(db);
  return db;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LIBRE_TOKEN_KEY", "a".repeat(64));
  vi.stubEnv("SUPABASE_URL", "https://invented.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "invented-server-key");
});
afterEach(() => vi.unstubAllEnvs());
describe("Libre server access boundaries", () => {
  it("rejects nonmembers before creating the privileged client", async () => {
    expect((await handleLibre(request, user, auth(null))).error).toContain("permissão");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("rejects readonly management before sending credentials upstream", async () => {
    expect((await handleLibre(request, user, auth("professional_readonly"))).error).toContain(
      "permissão",
    );
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("reports missing server configuration honestly without credential collection", async () => {
    vi.stubEnv("LIBRE_TOKEN_KEY", "");
    const result = await handleLibre({ action: "status", pid }, user, auth("caregiver"));
    expect(result.status).toMatchObject({ ready: false, connected: false });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("does not sync a disconnected account", async () => {
    database([null]);
    expect(await handleLibre({ action: "sync", pid }, user, auth("patient"))).toEqual({
      inserted: 0,
    });
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("rate limits login persistently before authenticating", async () => {
    const db = database([null]);
    db.rpc.mockResolvedValue({ data: false, error: null });
    expect((await handleLibre(request, user, auth("caregiver"))).error).toContain("minuto");
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("does not fetch when the connection creator lost patient access", async () => {
    database([
      {
        sealed_ticket: "encrypted",
        revision: "revision",
        connected_by: "removed-user",
        expires_at: new Date(Date.now() + 60000).toISOString(),
      },
      null,
    ]);
    expect((await handleLibre({ action: "sync", pid }, user, auth("caregiver"))).error).toContain(
      "permissão",
    );
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("does not poll while another tab owns the server cooldown", async () => {
    database([
      {
        sealed_ticket: "encrypted",
        revision: "revision",
        connected_by: user,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      },
      { role: "caregiver" },
      [],
    ]);
    expect(await handleLibre({ action: "sync", pid }, user, auth("caregiver"))).toEqual({
      inserted: 0,
    });
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("never returns encrypted tickets, revision or remote person identifiers in status", async () => {
    database([
      {
        sealed_ticket: "private-ticket",
        revision: "private-revision",
        libre_patient_id: "private-id",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        display_name: "Pessoa inventada",
        last_sync_at: null,
      },
    ]);
    const result = await handleLibre({ action: "status", pid }, user, auth("caregiver"));
    expect(result.status).toMatchObject({ connected: true, name: "Pessoa inventada" });
    expect(JSON.stringify(result)).not.toContain("private-");
  });
  it("sanitizes unexpected upstream failures without exposing secrets", async () => {
    const db = database([null]);
    db.rpc.mockResolvedValue({ data: true, error: null });
    mocks.login.mockRejectedValue(new Error("raw response invented-password private-token"));
    const result = await handleLibre(request, user, auth("caregiver"));
    expect(result.error).toContain("indisponível");
    expect(JSON.stringify(result)).not.toMatch(/invented-password|private-token/);
  });
});
