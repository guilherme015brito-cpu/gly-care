import { describe, expect, it } from "vitest";
import { chartReadings } from "@/lib/glucose/chart-data";
import type { GlucoseReading } from "@/lib/domain/types";

const base = {
  patient_id: "demo",
  value: 120,
  value_mgdl: 120,
  unit: "mg/dL",
  source: "simulation",
  trend: "stable",
  quality: "valid",
  provider_id: "demo",
  received_at: "",
  external_id: null,
  notes: null,
} as const;
const at = (minute: number, overrides: Partial<GlucoseReading> = {}): GlucoseReading => ({
  ...base,
  id: String(minute),
  measured_at: new Date(minute * 60000).toISOString(),
  ...overrides,
});
describe("Glucose chart data", () => {
  it("sorts readings and keeps gaps instead of bridging missing intervals", () => {
    const { auto } = chartReadings([at(50), at(5), at(10)], 0, 60 * 60000);
    expect(auto.map((p) => p.v)).toEqual([120, 120, null, 120]);
  });
  it("separates manual points, excludes invalid and out-of-period values", () => {
    const result = chartReadings(
      [at(10), at(15, { source: "manual" }), at(20, { quality: "invalid" }), at(70)],
      0,
      60 * 60000,
    );
    expect(result.auto).toHaveLength(1);
    expect(result.manual).toHaveLength(1);
    expect(result.valid).toHaveLength(2);
  });
});
