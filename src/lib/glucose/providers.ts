import type { GlucoseReading, GlucoseSource, GlucoseTrend, GlucoseUnit, ReadingQuality } from "../domain/types";
import { toMgdl } from "./status";

/** Reading as delivered by a provider, before persistence. Original value/unit are preserved. */
export interface IncomingReading {
  value: number;
  unit: GlucoseUnit;
  measured_at: string;
  received_at: string;
  source: GlucoseSource;
  provider_id: string;
  external_id: string | null;
  trend: GlucoseTrend;
  quality: ReadingQuality;
  raw_payload?: unknown;
  notes?: string | null;
}

export interface GlucoseProvider {
  readonly id: string;
  readonly source: GlucoseSource;
  readonly label: string;
  /** "available" | "not_configured" | "not_implemented" */
  status(): "available" | "not_configured" | "not_implemented";
  /** Fetch readings measured after `since`. Must NOT interpolate missing points. */
  fetchSince(since: Date): Promise<IncomingReading[]>;
}

/** Deterministic pseudo-random for stable demo curves. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function trendFromDelta(deltaPer5min: number): GlucoseTrend {
  if (deltaPer5min > 10) return "rising_fast";
  if (deltaPer5min > 4) return "rising";
  if (deltaPer5min < -10) return "falling_fast";
  if (deltaPer5min < -4) return "falling";
  return "stable";
}

/**
 * SIMULATION ONLY. Values are synthetic and always flagged source="simulation".
 * Includes a deliberate connectivity gap so the UI shows missing data honestly.
 */
export class MockGlucoseProvider implements GlucoseProvider {
  readonly id = "mock";
  readonly source = "simulation" as const;
  readonly label = "Simulação (dados fictícios)";
  status() {
    return "available" as const;
  }
  async fetchSince(since: Date): Promise<IncomingReading[]> {
    const step = 15 * 60000;
    const now = Date.now();
    const start = Math.ceil(since.getTime() / step) * step;
    const rnd = seeded(42);
    const out: IncomingReading[] = [];
    let prev: number | null = null;
    for (let t = start; t <= now; t += step) {
      const hours = (now - t) / 3600000;
      // simulated sensor gap between 9h and 11h ago
      if (hours > 9 && hours < 11) {
        prev = null;
        continue;
      }
      const hourOfDay = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const base =
        135 +
        45 * Math.sin((hourOfDay / 24) * Math.PI * 4) +
        30 * Math.sin((t / 3600000) * 0.7) +
        (rnd() - 0.5) * 14;
      const v = Math.max(55, Math.min(320, Math.round(base)));
      const trend: GlucoseTrend = prev == null ? "unknown" : trendFromDelta((v - prev) / 3);
      out.push({
        value: v,
        unit: "mg/dL",
        measured_at: new Date(t).toISOString(),
        received_at: new Date(t + 60000).toISOString(),
        source: "simulation",
        provider_id: this.id,
        external_id: `mock-${t}`,
        trend,
        quality: "valid",
      });
      prev = v;
    }
    return out;
  }
}

/** Manual entries come from the user; this adapter only normalizes them. */
export class ManualGlucoseProvider implements GlucoseProvider {
  readonly id = "manual";
  readonly source = "manual" as const;
  readonly label = "Glicosímetro / entrada manual";
  status() {
    return "available" as const;
  }
  async fetchSince(): Promise<IncomingReading[]> {
    return []; // manual readings are pushed, not pulled
  }
  build(input: { value: number; unit: GlucoseUnit; measured_at: string; notes?: string | null }): IncomingReading {
    return {
      value: input.value,
      unit: input.unit,
      measured_at: input.measured_at,
      received_at: new Date().toISOString(),
      source: "manual",
      provider_id: this.id,
      external_id: null,
      trend: "unknown",
      quality: "valid",
      notes: input.notes ?? null,
    };
  }
}

/**
 * Placeholder for a future, officially authorized FreeStyle Libre integration
 * (e.g. through an approved partner API). Intentionally NOT implemented:
 * no scraping, no unofficial auth, no credential capture.
 */
export class FutureLibreProvider implements GlucoseProvider {
  readonly id = "libre";
  readonly source = "external" as const;
  readonly label = "FreeStyle Libre (integração futura)";
  status() {
    return "not_implemented" as const;
  }
  async fetchSince(): Promise<IncomingReading[]> {
    throw new Error("Integração com FreeStyle Libre ainda não implementada.");
  }
}

export const PROVIDERS: GlucoseProvider[] = [
  new MockGlucoseProvider(),
  new ManualGlucoseProvider(),
  new FutureLibreProvider(),
];

/** Idempotency key: provider + external id, or provider + measured timestamp. */
export function dedupeKey(r: Pick<IncomingReading, "provider_id" | "external_id" | "measured_at">): string {
  return r.external_id
    ? `${r.provider_id}::ext::${r.external_id}`
    : `${r.provider_id}::ts::${new Date(r.measured_at).toISOString()}`;
}

/**
 * Merge incoming readings into an existing set, ignoring duplicates.
 * Returns only the readings that are genuinely new.
 */
export function filterNewReadings<T extends Pick<IncomingReading, "provider_id" | "external_id" | "measured_at">>(
  existing: Array<Pick<GlucoseReading, "provider_id" | "external_id" | "measured_at">>,
  incoming: T[],
): T[] {
  const seen = new Set(existing.map(dedupeKey));
  const out: T[] = [];
  for (const r of incoming) {
    const k = dedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function normalize(r: IncomingReading, patient_id: string, id: string): GlucoseReading {
  return {
    id,
    patient_id,
    value: r.value,
    unit: r.unit,
    value_mgdl: toMgdl(r.value, r.unit),
    measured_at: r.measured_at,
    received_at: r.received_at,
    source: r.source,
    provider_id: r.provider_id,
    external_id: r.external_id,
    trend: r.trend,
    quality: r.quality,
    notes: r.notes ?? null,
  };
}
