import { describe, expect, it, beforeEach } from "vitest";
import { injectionContext, normalizeInjectionSite, siteRotation } from "@/lib/injection-sites";
import { administrationSchema } from "@/lib/validation";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";

beforeEach(() => resetDemoStore());
describe("Injection rotation", () => {
  it("requires a canonical location, including planned administrations", () => {
    const base = {
      insulin_id: "i",
      dose: "2",
      administered_at: new Date().toISOString(),
      purpose: "meal",
      status: "planned",
      confirmed: false,
    };
    for (const site of [undefined, "", "qualquer lugar"])
      expect(administrationSchema.safeParse({ ...base, injection_site: site }).success).toBe(false);
    expect(
      administrationSchema.safeParse({ ...base, injection_site: "Perna (coxa)" }).success,
    ).toBe(true);
    expect(normalizeInjectionSite("braço esquerdo")).toBe("Braço");
  });
  it("warns on repetition, blocks the fourth, and resets after another region", async () => {
    const store = getDemoStore(),
      pid = "demo-patient";
    const insulin = (await store.listCatalog())[0]!;
    const at = "2020-01-01T12:00:00Z";
    const input = administrationSchema.parse({
      insulin_id: insulin.id,
      dose: "2",
      administered_at: at,
      purpose: "meal",
      status: "performed",
      confirmed: true,
      injection_site: "Braço",
    });
    for (let i = 0; i < 3; i++)
      await store.addAdministration(pid, { ...input, administered_at: `2020-01-01T12:0${i}:00Z` });
    const ctx = await store.getInjectionContext(pid, "2020-01-01T12:03:00Z");
    expect(siteRotation(ctx, "Braço")).toEqual({ previous: 3, repeated: true, blocked: true });
    await expect(
      store.addAdministration(pid, { ...input, administered_at: "2020-01-01T12:03:00Z" }),
    ).rejects.toThrow("Rodízio");
    await store.addAdministration(pid, {
      ...input,
      administered_at: "2020-01-01T12:03:00Z",
      injection_site: "Perna (coxa)",
    });
    await expect(
      store.addAdministration(pid, { ...input, administered_at: "2020-01-01T12:04:00Z" }),
    ).resolves.toBeUndefined();
    expect(
      siteRotation(await store.getInjectionContext(pid, "2020-01-01T12:05:00Z"), "Braço").previous,
    ).toBe(1);
  });
  it("counts performed records only, excludes other patients, deletion and superseded records, and checks backfills", async () => {
    const store = getDemoStore();
    const row = (await store.listAdministrations("demo-patient"))[0]!;
    const rows = [0, 1, 2].map((i) => ({
      ...row,
      id: String(i),
      injection_site: "Braço",
      administered_at: `2020-01-01T12:0${i}:00Z`,
    }));
    expect(
      siteRotation(injectionContext(rows, "demo-patient", "2020-01-01T12:00:30Z"), "Braço").blocked,
    ).toBe(true);
    for (const patch of [
      { status: "planned" as const },
      { is_superseded: true },
      { deleted_at: "2020-01-02" },
      { patient_id: "other" },
      { confirmed_by_user: false },
    ]) {
      expect(
        siteRotation(
          injectionContext(
            rows.map((r) => ({ ...r, ...patch })),
            "demo-patient",
            "2020-01-01T13:00:00Z",
          ),
          "Braço",
        ).blocked,
      ).toBe(false);
    }
    expect(
      siteRotation({ previous: [null, "Braço", "Braço"], following: [] }, "Braço").previous,
    ).toBe(0);
  });
  it("revalidates location when confirming pending records", async () => {
    const s = getDemoStore(),
      pid = "demo-patient",
      insulin = (await s.listCatalog())[0]!;
    const input = administrationSchema.parse({
      insulin_id: insulin.id,
      dose: "2",
      administered_at: "2020-01-01T11:00:00Z",
      purpose: "meal",
      status: "planned",
      confirmed: false,
      injection_site: "Braço",
    });
    await s.addAdministration(pid, input);
    const pending = (await s.listAdministrations(pid, 500)).find((a) => a.status === "planned")!;
    for (let i = 0; i < 3; i++)
      await s.addAdministration(pid, {
        ...input,
        status: "performed",
        confirmed: true,
        administered_at: `2020-01-01T12:0${i}:00Z`,
      });
    await expect(
      s.markAdministrationPerformed(pending.id, "2020-01-01T13:00:00Z", "Braço"),
    ).rejects.toThrow("Rodízio");
    await s.markAdministrationPerformed(pending.id, "2020-01-01T13:00:00Z", "Nádega");
    expect(
      (await s.listAdministrations(pid, 500)).find((a) => a.id === pending.id)?.injection_site,
    ).toBe("Nádega");
  });
});
