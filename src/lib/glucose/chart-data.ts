import type { GlucoseReading } from "../domain/types";
import { CHART_GAP_MIN } from "./status";

export function chartReadings(readings: GlucoseReading[], from: number, to: number) {
  const valid = readings
    .filter(
      (r) =>
        r.quality !== "invalid" &&
        Number.isFinite(r.value_mgdl) &&
        new Date(r.measured_at).getTime() >= from &&
        new Date(r.measured_at).getTime() <= to,
    )
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const auto: Array<{ t: number; v: number | null }> = [];
  let prev: number | null = null;
  for (const r of valid.filter((x) => x.source !== "manual")) {
    const t = new Date(r.measured_at).getTime();
    // A missing interval must remain a visible break, never an invented curve.
    if (prev != null && t - prev > CHART_GAP_MIN * 60000) auto.push({ t: prev + 1, v: null });
    auto.push({ t, v: r.value_mgdl });
    prev = t;
  }
  const manual = valid
    .filter((r) => r.source === "manual")
    .map((r) => ({ t: new Date(r.measured_at).getTime(), m: r.value_mgdl }));
  return { auto, manual, valid };
}
