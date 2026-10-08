import type { ClinicalSettings, GlucoseReading } from "../domain/types";

export type GlucoseBand = "very_low" | "low" | "in_range" | "high" | "very_high";

export const BAND_LABEL: Record<GlucoseBand, string> = {
  very_low: "Muito baixa",
  low: "Abaixo da faixa",
  in_range: "Na faixa-alvo",
  high: "Acima da faixa",
  very_high: "Muito alta",
};

type Ranges = Pick<ClinicalSettings, "very_low_mgdl" | "target_low_mgdl" | "target_high_mgdl" | "very_high_mgdl">;

export function classifyGlucose(mgdl: number, r: Ranges): GlucoseBand {
  if (mgdl < r.very_low_mgdl) return "very_low";
  if (mgdl < r.target_low_mgdl) return "low";
  if (mgdl <= r.target_high_mgdl) return "in_range";
  if (mgdl <= r.very_high_mgdl) return "high";
  return "very_high";
}

/** Minutes after which the latest reading is considered stale. */
export const STALE_AFTER_MIN = 20;

export function isStale(r: GlucoseReading | undefined, now = Date.now()): boolean {
  if (!r) return true;
  return now - new Date(r.measured_at).getTime() > STALE_AFTER_MIN * 60000;
}

export const MMOL_TO_MGDL = 18.0182;
export const toMgdl = (value: number, unit: "mg/dL" | "mmol/L") =>
  unit === "mg/dL" ? value : Math.round(value * MMOL_TO_MGDL * 10) / 10;

/** Max gap (min) between consecutive readings before the chart line is broken. */
export const CHART_GAP_MIN = 20;
