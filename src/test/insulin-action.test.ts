import { describe, expect, it } from "vitest";
import {
  DEMO_INSULIN_PROFILES,
  demoActionApplications,
  demoActionSeries,
  illustrativeAction,
} from "@/lib/insulin/demo-action";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import type { InsulinAdministration } from "@/lib/domain/types";
import { computeItem, sumItems } from "@/lib/nutrition";
import { tacoFoods } from "@/lib/taco-foods";

describe("Illustrative insulin action, not IOB", () => {
  it("keeps the Fiasp profile bounded, with sourced landmarks and no future action", () => {
    const p = DEMO_INSULIN_PROFILES.fiasp;
    expect(illustrativeAction(p, -1)).toBe(0);
    expect(illustrativeAction(p, 17)).toBe(0);
    expect(illustrativeAction(p, 120)).toBe(100);
    expect(illustrativeAction(p, 300)).toBe(0);
    expect(illustrativeAction(p, NaN)).toBe(0);
    for (let i = 0; i <= 500; i++) expect(illustrativeAction(p, i)).toBeGreaterThanOrEqual(0);
  });
  it("draws a flat basal plateau, not a rapid peak", () => {
    const p = DEMO_INSULIN_PROFILES.lantus;
    expect(p.peakMinutes).toBeNull();
    expect(illustrativeAction(p, 240)).toBe(100);
    expect(illustrativeAction(p, 1200)).toBe(100);
    expect(illustrativeAction(p, 1440)).toBe(0);
  });
  it("excludes planned, unconfirmed, superseded and unknown administrations", async () => {
    resetDemoStore();
    const s = getDemoStore();
    const catalog = await s.listCatalog();
    const a = (await s.listAdministrations("demo-patient"))[0]!;
    const rows: InsulinAdministration[] = [
      a,
      { ...a, id: "planned", status: "planned" },
      { ...a, id: "unconfirmed", confirmed_by_user: false },
      { ...a, id: "old", is_superseded: true },
      { ...a, id: "unknown", insulin_id: "unknown" },
    ];
    expect(demoActionApplications(rows, catalog).map((r) => r.administration.id)).toEqual([a.id]);
  });
  it("includes exact landmarks, keeps each application independent and filters invalid dates", async () => {
    resetDemoStore();
    const s = getDemoStore();
    const catalog = await s.listCatalog();
    const apps = demoActionApplications(await s.listAdministrations("demo-patient"), catalog);
    const rapid = apps.find((a) => a.profile.role === "rapid")!;
    const data = demoActionSeries(apps, rapid.start - 10000, rapid.end + 10000);
    expect(data.find((p) => p["ts"] === rapid.peak)?.[rapid.administration.id]).toBe(100);
    expect(data.find((p) => p["ts"] === rapid.end)?.[rapid.administration.id]).toBe(0);
    expect(demoActionSeries(apps, NaN, 100)).toEqual([]);
    expect(
      demoActionApplications([{ ...rapid.administration, administered_at: "invalid" }], catalog),
    ).toEqual([]);
  });
  it("seeds the user's fictional Lantus schedule and real product references", async () => {
    resetDemoStore();
    const s = getDemoStore();
    const [catalog, patients, profiles] = await Promise.all([
      s.listCatalog(),
      s.listPatientInsulins("demo-patient"),
      s.listActionProfiles(),
    ]);
    const lantus = catalog.find((i) => i.brand_name === "Lantus")!;
    expect(catalog.some((i) => i.brand_name === "Fiasp")).toBe(true);
    expect(patients.find((p) => p.insulin_id === lantus.id)?.role).toBe("basal");
    expect(patients.find((p) => p.insulin_id === lantus.id)?.prescribed_dose_text).toContain(
      "18 UI às 07:00 e 12 UI às 22:00",
    );
    expect(profiles.find((p) => p.insulin_id === lantus.id)?.peak_text).toBe(
      "Sem pico pronunciado",
    );
    for (const a of (await s.listAdministrations("demo-patient")).filter(
      (a) => a.insulin_id === lantus.id,
    )) {
      expect(new Date(a.administered_at).getTime()).toBeLessThanOrEqual(Date.now());
      expect(a.dose_units).toBe(new Date(a.administered_at).getHours() === 7 ? 18 : 12);
    }
  });
  it("rejects an invalid integrated save before changing meals or administrations", async () => {
    resetDemoStore();
    const s = getDemoStore();
    const item = computeItem(
      tacoFoods.find((f) => f.name === "Arroz, tipo 1, cozido")!,
      100,
    );
    const totals = sumItems([item]);
    const beforeMeals = (await s.listMeals("demo-patient")).length;
    const beforeAdmins = (await s.listAdministrations("demo-patient")).length;
    await expect(
      s.addMealWithAdministration(
        "demo-patient",
        {
          meal_type: "lunch",
          eaten_at: new Date().toISOString(),
          items: [item],
          totals: { ...totals, carbs_g: totals.carbs_g! },
          notes: null,
          is_favorite: false,
          favorite_name: null,
        },
        {
          insulin_id: "missing",
          dose: 3,
          administered_at: new Date().toISOString(),
          purpose: "meal",
          status: "performed",
          confirmed: true,
          glucose_before: 180,
          notes: null,
          injection_site: "Braço",
          recorded_by_name: null,
        },
      ),
    ).rejects.toThrow("Nada foi registrado");
    expect(await s.listMeals("demo-patient")).toHaveLength(beforeMeals);
    expect(await s.listAdministrations("demo-patient")).toHaveLength(beforeAdmins);
  });
});
