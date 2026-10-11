import { z } from "zod";
import type { IncomingReading } from "./providers";
import type { GlucoseTrend } from "../domain/types";

export const libreItemSchema = z.object({
  FactoryTimestamp: z.string(),
  ValueInMgPerDl: z.number().finite().min(10).max(1000),
  TrendArrow: z.number().optional(),
  isHigh: z.boolean().optional(),
  isLow: z.boolean().optional(),
});
const graphSchema = z.object({
  connection: z.object({
    patientId: z.string(),
    glucoseMeasurement: libreItemSchema.optional(),
    glucoseItem: libreItemSchema.optional(),
  }),
  graphData: z.array(libreItemSchema).max(2000),
});

/** FactoryTimestamp without a zone is UTC, never the phone/server local time. */
export function libreTimestamp(input: string): string | null {
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
  if (zoned.test(input)) {
    if (!libreTimestamp(input.slice(0, 19))) return null;
    const date = new Date(input);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),? (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i.exec(input);
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/.exec(input);
  if (!us && !iso) return null;
  const [year, month, day, hour, minute, second] = us
    ? [
        Number(us[3]),
        Number(us[1]),
        Number(us[2]),
        (Number(us[4]) % 12) + (us[7]!.toUpperCase() === "PM" ? 12 : 0),
        Number(us[5]),
        Number(us[6]),
      ]
    : [
        Number(iso![1]),
        Number(iso![2]),
        Number(iso![3]),
        Number(iso![4]),
        Number(iso![5]),
        Number(iso![6]),
      ];
  if (us && (Number(us[4]) < 1 || Number(us[4]) > 12)) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  )
    return null;
  return date.toISOString();
}

export function normalizeLibreGraph(
  payload: unknown,
  selected: string,
  now = Date.now(),
): IncomingReading[] {
  const graph = graphSchema.parse(payload);
  if (graph.connection.patientId !== selected) throw new Error("selection");
  const current = graph.connection.glucoseMeasurement ?? graph.connection.glucoseItem;
  const trends: Record<number, GlucoseTrend> = {
    1: "falling_fast",
    2: "falling",
    3: "stable",
    4: "rising",
    5: "rising_fast",
  };
  const readings = new Map<string, IncomingReading>();
  for (const item of [...graph.graphData, ...(current ? [current] : [])]) {
    const at = libreTimestamp(item.FactoryTimestamp);
    if (!at || new Date(at).getTime() > now + 60000) throw new Error("format");
    readings.set(at, {
      value: item.ValueInMgPerDl,
      unit: "mg/dL",
      measured_at: at,
      received_at: new Date(now).toISOString(),
      source: "external",
      provider_id: "librelinkup",
      external_id: `${selected}:${at}`,
      trend: trends[item.TrendArrow ?? 0] ?? "unknown",
      quality: item.isHigh || item.isLow ? "questionable" : "valid",
      notes: item.isHigh
        ? "Leitura limitada pelo sensor (HI)."
        : item.isLow
          ? "Leitura limitada pelo sensor (LO)."
          : null,
    });
  }
  return [...readings.values()].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
}
