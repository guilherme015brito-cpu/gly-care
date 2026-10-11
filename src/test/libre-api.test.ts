// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibreApi } from "@/lib/glucose/libre-api.server";
import { openLibre, sealLibre } from "@/lib/glucose/libre-crypto.server";
const ticket = {
  token: "invented-ticket",
  account: "a".repeat(64),
  expires: Date.now() / 1000 + 3600,
  region: "LA",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const login = () => ({
  status: 0,
  data: {
    user: { id: "invented-account" },
    authTicket: { token: ticket.token, expires: ticket.expires },
  },
});
afterEach(() => vi.restoreAllMocks());
describe("Libre API read-only protocol", () => {
  it("follows only known regional redirects and hashes the account header", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ status: 0, data: { redirect: true, region: "EU" } }))
      .mockResolvedValueOnce(response(login()))
      .mockResolvedValueOnce(response({ status: 0, data: [] }));
    const api = new LibreApi(transport);
    const result = await api.login("fake@example.test", "invented-password", "LA");
    expect(result.region).toBe("EU");
    expect(result.account).toMatch(/^[a-f0-9]{64}$/);
    await api.candidates(result);
    expect(transport.mock.calls[0]?.[0]).toBe("https://api-la.libreview.io/llu/auth/login");
    expect(transport.mock.calls[2]?.[1]?.headers).toMatchObject({
      "account-id": result.account,
      Authorization: "Bearer invented-ticket",
    });
    expect(transport.mock.calls[2]?.[1]?.body).toBeUndefined();
  });
  it("never sends credentials to an unknown redirect host", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ status: 0, data: { redirect: true, region: "attacker.test" } }),
      );
    await expect(
      new LibreApi(transport).login("fake@example.test", "invented-password", "LA"),
    ).rejects.toMatchObject({ code: "format" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.[1]?.redirect).toBe("error");
  });
  it("does not accept terms or account actions on the user's behalf", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ status: 4, data: { step: { type: "tou" }, token: "private" } }),
      );
    await expect(
      new LibreApi(transport).login("fake@example.test", "invented-password", "LA"),
    ).rejects.toMatchObject({ code: "account" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    [429, "throttled"],
    [401, "expired"],
    [403, "unavailable"],
    [500, "unavailable"],
  ])("sanitizes HTTP %i", async (status, code) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ password: "never-expose", token: "never-expose" }, Number(status)),
      );
    try {
      await new LibreApi(transport).candidates(ticket);
      throw new Error("Should fail");
    } catch (error) {
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain("never-expose");
    }
  });
  it("returns all people for explicit selection, not an arbitrary first person", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        status: 0,
        data: [
          { patientId: "a", firstName: "Pessoa", lastName: "A" },
          { patientId: "b", firstName: "Pessoa", lastName: "B" },
        ],
      }),
    );
    expect(await new LibreApi(transport).candidates(ticket)).toHaveLength(2);
  });
  it("rejects graph identity mismatch", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ status: 0, data: { connection: { patientId: "wrong" }, graphData: [] } }),
      );
    await expect(new LibreApi(transport).graph(ticket, "selected")).rejects.toMatchObject({
      code: "selection",
    });
  });
});
describe("server-only encrypted ticket", () => {
  const key = "a".repeat(64);
  it("uses randomized authenticated encryption and does not reveal the token", async () => {
    const first = await sealLibre(ticket, key, "patient-a");
    const second = await sealLibre(ticket, key, "patient-a");
    expect(first).not.toBe(second);
    expect(first).not.toContain(ticket.token);
    expect(await openLibre(first, key, "patient-a")).toEqual(ticket);
    await expect(openLibre(first, key, "patient-b")).rejects.toThrow();
    await expect(openLibre(first, "b".repeat(64), "patient-a")).rejects.toThrow();
  });
  it("rejects tampering and malformed encryption keys", async () => {
    const payload = JSON.parse(await sealLibre(ticket, key, "patient-a"));
    payload.data[0] ^= 1;
    await expect(openLibre(JSON.stringify(payload), key, "patient-a")).rejects.toThrow();
    await expect(sealLibre(ticket, "bad-key", "patient-a")).rejects.toThrow();
  });
});
