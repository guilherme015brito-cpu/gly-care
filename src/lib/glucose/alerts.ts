import type { ClinicalSettings, GlucoseReading } from "../domain/types";
import { classifyGlucose, STALE_AFTER_MIN, type GlucoseBand } from "./status";

export const GLUCOSE_ALERT_REPEAT_MS = 15 * 60_000;
export interface GlucoseAlertState {
  key: string;
  band: GlucoseBand;
  sentAt: number;
}
export function currentGlucoseAlert(
  readings: GlucoseReading[],
  settings: ClinicalSettings,
  mode: string,
  pid: string,
  now: number,
) {
  const reading = readings
    .filter((r) => r.patient_id === pid)
    .reduce<GlucoseReading | undefined>(
      (latest, r) =>
        !latest || Date.parse(r.measured_at) > Date.parse(latest.measured_at) ? r : latest,
      undefined,
    );
  if (!reading) return null;
  const age = now - Date.parse(reading.measured_at);
  if (
    reading.quality !== "valid" ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > STALE_AFTER_MIN * 60_000 ||
    !Number.isFinite(reading.value_mgdl) ||
    reading.value_mgdl <= 0 ||
    (mode === "demo" ? reading.source !== "simulation" : reading.source === "simulation")
  )
    return null;
  const limits = [
    settings.very_low_mgdl,
    settings.target_low_mgdl,
    settings.target_high_mgdl,
    settings.very_high_mgdl,
  ];
  if (
    !limits.every((n) => Number.isFinite(n) && n > 0) ||
    !limits.every((n, i) => i === 0 || n > limits[i - 1]!)
  )
    return null;
  return {
    reading,
    band: classifyGlucose(reading.value_mgdl, settings),
    key: `${reading.provider_id}:${reading.id}:${reading.measured_at}:${reading.value_mgdl}`,
  };
}

export function shouldNotifyGlucose(
  candidate: NonNullable<ReturnType<typeof currentGlucoseAlert>>,
  previous: GlucoseAlertState | null,
  now: number,
) {
  if (candidate.band === "in_range" || candidate.key === previous?.key) return false;
  if (!previous || previous.band === "in_range") return true;
  const low = (b: GlucoseBand) => b === "low" || b === "very_low";
  if (low(candidate.band) !== low(previous.band)) return true;
  if (
    (candidate.band === "very_low" && previous.band === "low") ||
    (candidate.band === "very_high" && previous.band === "high")
  )
    return true;
  return now - previous.sentAt >= GLUCOSE_ALERT_REPEAT_MS;
}
