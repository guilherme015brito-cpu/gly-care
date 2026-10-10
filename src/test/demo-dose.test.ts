import { describe, expect, it } from "vitest";
import {
  calculateDemoDose,
  calculateDemoCorrection,
  decimal,
  demoParameters,
  demoCorrectionParameters,
} from "@/lib/demo-dose";
import { DEFAULT_SETTINGS, type ClinicalSettings } from "@/lib/domain/types";

const settings: ClinicalSettings = {
  ...DEFAULT_SETTINGS,
  patient_id: "demo",
  target_glucose_text: "120",
  sensitivity_factor_text: "30",
  carb_ratios: [
    { from: "11:00", to: "15:00", ratio_text: "1 UI : 12 g" },
    { from: "18:00", to: "06:00", ratio_text: "1 UI : 15 g" },
  ],
};
describe("Demonstrative dose arithmetic", () => {
  it("combines carbs and correction without confusing the two factors", () => {
    expect(calculateDemoDose(36, 180, 120, 30, 12, 0.5)).toEqual({
      meal: 3,
      correction: 2,
      total: 5,
      rounded: 5,
    });
  });
  it("rounds to half units and does not create negative corrections", () => {
    expect(calculateDemoDose(30, 100, 120, 30, 12, 0.5)).toMatchObject({
      correction: 0,
      rounded: 2.5,
    });
    expect(calculateDemoDose(28.1, 180, 120, 30, 12, 0.5)?.rounded).toBe(4.5);
  });
  it("rejects missing values and invalid divisors", () => {
    expect(calculateDemoDose(null, 180, 120, 30, 12, 0.5)).toBeNull();
    expect(calculateDemoDose(36, 180, 120, 0, 12, 0.5)).toBeNull();
    expect(calculateDemoDose(36, 180, 120, 30, 0, 0.5)).toBeNull();
    expect(calculateDemoDose(NaN, 180, 120, 30, 12, 0.5)).toBeNull();
    expect(decimal("12,5")).toBe(12.5);
    expect(decimal("")).toBeNull();
    expect(decimal("12abc")).toBeNull();
  });
  it("allows fictitious edge cases without arbitrary clinical caps", () => {
    expect(calculateDemoDose(36, 60, 120, 30, 12, 0.5)).toMatchObject({ correction: 0, total: 3 });
    expect(calculateDemoDose(600, 720, 120, 30, 12, 0.5)).toMatchObject({
      meal: 50,
      correction: 20,
      total: 70,
    });
    expect(calculateDemoDose(1, 120, 120, 30, 3, 0)?.rounded).toBeCloseTo(1 / 3);
    expect(calculateDemoCorrection(180, 120, 30, 0.1)?.rounded).toBe(2);
    expect(calculateDemoDose(Number.MAX_VALUE, 180, 120, 30, 0.001, 0.5)).toBeNull();
  });
  it("calculates correction independently from meal schedules", () => {
    expect(demoCorrectionParameters({ ...settings, carb_ratios: [] })).toMatchObject({
      target: 120,
      sensitivity: 30,
    });
    expect(calculateDemoCorrection(180, 120, 30, 0.5)?.rounded).toBe(2);
    expect(calculateDemoCorrection(100, 120, 30, 0.5)?.rounded).toBe(0);
  });
  it("selects local-time bands including overnight and excludes the end", () => {
    expect(demoParameters(settings, new Date(2026, 9, 10, 12))).toMatchObject({ ratio: 12 });
    expect(demoParameters(settings, new Date(2026, 9, 11, 2))).toMatchObject({ ratio: 15 });
    expect(demoParameters(settings, new Date(2026, 9, 10, 15))).toHaveProperty("error");
  });
  it("rejects overlapping bands and ambiguous prescription text", () => {
    expect(
      demoParameters(
        { ...settings, carb_ratios: [...settings.carb_ratios, settings.carb_ratios[0]!] },
        new Date(2026, 9, 10, 12),
      ),
    ).toHaveProperty("error");
    expect(
      demoParameters(
        { ...settings, sensitivity_factor_text: "Conforme prescrição" },
        new Date(2026, 9, 10, 12),
      ),
    ).toHaveProperty("error");
  });
});
