import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type ClinicalSettings } from "@/lib/domain/types";
import { calculateDemoDose, demoCorrectionParameters, demoParameters } from "@/lib/demo-dose";
import { validateDosePeriods } from "@/lib/dose-periods";

const settings: ClinicalSettings = {
  ...DEFAULT_SETTINGS,
  patient_id: "invented",
  target_glucose_text: "120",
  carb_ratios: [
    {
      meal_type: "breakfast",
      from: "00:00",
      to: "11:00",
      sensitivity_text: "20",
      ratio_text: "10",
    },
    { meal_type: "lunch", from: "11:00", to: "15:00", sensitivity_text: "30", ratio_text: "12" },
    { meal_type: "snack", from: "15:00", to: "18:00", sensitivity_text: "30", ratio_text: "10" },
    { meal_type: "dinner", from: "18:00", to: "00:00", sensitivity_text: "40", ratio_text: "18" },
  ],
};

describe("Sensitivity and carbohydrate factors by period", () => {
  it.each([
    [8, 20, 10, 6.6],
    [12, 30, 12, 5],
    [16, 30, 10, 5.6],
    [20, 40, 18, 3.5],
  ])(
    "uses separate factors at hour %s in fictional arithmetic",
    (hour, sensitivity, ratio, total) => {
      const p = demoParameters(settings, new Date(2026, 9, 11, hour));
      if ("error" in p) throw new Error(p.error);
      expect(p).toMatchObject({ sensitivity, ratio });
      expect(calculateDemoDose(36, 180, p.target, p.sensitivity, p.ratio, 0)?.total).toBeCloseTo(
        total,
      );
    },
  );
  it("uses the explicitly chosen meal even outside its monitoring time band", () => {
    expect(demoParameters(settings, new Date(2026, 9, 11, 20), "breakfast")).toMatchObject({
      sensitivity: 20,
      ratio: 10,
    });
    expect(demoParameters(settings, new Date(2026, 9, 11, 8), "dinner")).toMatchObject({
      sensitivity: 40,
      ratio: 18,
    });
  });
  it("switches monitoring sensitivity at exclusive endpoints and midnight", () => {
    for (const [hour, sensitivity] of [
      [0, 20],
      [11, 30],
      [15, 30],
      [18, 40],
      [23, 40],
    ])
      expect(demoCorrectionParameters(settings, new Date(2026, 9, 11, hour))).toMatchObject({
        sensitivity,
      });
  });
  it("keeps the old global sensitivity and text ratios compatible", () => {
    const legacy = {
      ...settings,
      sensitivity_factor_text: "30 mg/dL/UI",
      carb_ratios: [{ from: "18:00", to: "06:00", ratio_text: "1 UI : 12 g" }],
    };
    expect(demoParameters(legacy, new Date(2026, 9, 11, 2))).toMatchObject({
      sensitivity: 30,
      ratio: 12,
    });
    expect(demoCorrectionParameters(legacy, new Date(2026, 9, 11, 12))).toMatchObject({
      sensitivity: 30,
    });
    expect(validateDosePeriods(legacy.carb_ratios)).toBeNull();
  });
  it("does not silently fall back for gaps, invalid dates or invalid configured factors", () => {
    const base = {
      ...settings,
      sensitivity_factor_text: "99",
      carb_ratios: [settings.carb_ratios[1]!],
    };
    expect(demoCorrectionParameters(base, new Date(2026, 9, 11, 9))).toHaveProperty("error");
    expect(demoParameters(settings, new Date("invalid"))).toHaveProperty("error");
    expect(
      demoParameters(
        { ...base, carb_ratios: [{ ...base.carb_ratios[0]!, sensitivity_text: "" }] },
        new Date(2026, 9, 11, 12),
      ),
    ).toHaveProperty("error");
  });
  it("accepts adjacent and overnight ranges but rejects overlaps and duplicate meals", () => {
    expect(validateDosePeriods(settings.carb_ratios)).toBeNull();
    expect(
      validateDosePeriods([
        { from: "22:00", to: "06:00", ratio_text: "12,5", sensitivity_text: "20,5" },
        { from: "06:00", to: "22:00", ratio_text: "10", sensitivity_text: "30" },
      ]),
    ).toBeNull();
    expect(
      validateDosePeriods([
        ...settings.carb_ratios,
        { from: "23:00", to: "02:00", ratio_text: "12" },
      ]),
    ).toContain("sobrepor");
    expect(
      validateDosePeriods([
        { ...settings.carb_ratios[0]!, to: "08:00" },
        { ...settings.carb_ratios[0]!, from: "08:00" },
      ]),
    ).toContain("tipo de refeição");
  });
  it.each(["0", "-20", "NaN", "20abc", ""])("rejects invalid sensitivity %s", (value) => {
    expect(
      validateDosePeriods([{ ...settings.carb_ratios[0]!, sensitivity_text: value }]),
    ).not.toBeNull();
  });
  it("rejects invalid times and carbohydrate divisors", () => {
    expect(validateDosePeriods([{ from: "25:00", to: "11:00", ratio_text: "12" }])).not.toBeNull();
    expect(validateDosePeriods([{ from: "11:00", to: "11:00", ratio_text: "12" }])).not.toBeNull();
    expect(validateDosePeriods([{ from: "00:00", to: "11:00", ratio_text: "0" }])).not.toBeNull();
  });
});
