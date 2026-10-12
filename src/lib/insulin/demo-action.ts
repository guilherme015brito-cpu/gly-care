import type {
  InsulinAdministration,
  InsulinCatalogItem,
  InsulinActionProfile,
} from "../domain/types";
import { REFERENCE_PRESETS, visualProfileSchema } from "./config";

export const DEMO_INSULIN_PROFILES = {
  fiasp: {
    name: "Fiasp",
    ...REFERENCE_PRESETS.fiasp.visual_profile,
    onsetText: REFERENCE_PRESETS.fiasp.onset_text,
    peakText: REFERENCE_PRESETS.fiasp.peak_text,
    durationText: REFERENCE_PRESETS.fiasp.effective_duration_text,
    source: REFERENCE_PRESETS.fiasp.source_reference,
    sourceLabel: "Novo Nordisk · bula, tabela 6",
  },
  lantus: {
    name: "Lantus",
    ...REFERENCE_PRESETS.lantus.visual_profile,
    onsetText: REFERENCE_PRESETS.lantus.onset_text,
    peakText: REFERENCE_PRESETS.lantus.peak_text,
    durationText: REFERENCE_PRESETS.lantus.effective_duration_text,
    source: REFERENCE_PRESETS.lantus.source_reference,
    sourceLabel: "Sanofi · bula, seção 12",
  },
} as const;

export interface DemoInsulinProfile {
  name: string;
  role: "rapid" | "basal";
  onsetMinutes: number | null;
  peakMinutes: number | null;
  durationMinutes: number;
  onsetText: string;
  peakText: string;
  durationText: string;
  source: string;
  sourceLabel: string;
}

export function demoInsulinProfile(
  item: InsulinCatalogItem | undefined,
): DemoInsulinProfile | null {
  const name = item?.brand_name.trim().toLocaleLowerCase();
  if (name === "fiasp") return DEMO_INSULIN_PROFILES.fiasp;
  if (name === "lantus") return DEMO_INSULIN_PROFILES.lantus;
  return null;
}

const smooth = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

/** Normalized illustration, NOT a pharmacokinetic model or an IOB calculation.
 * The drawing landmarks are illustrative, not calculated from the recorded dose.
 * Lantus uses an illustrative flat plateau with drawn-in entry/exit ramps.
 */
export function illustrativeAction(profile: DemoInsulinProfile, elapsedMinutes: number): number {
  if (
    !Number.isFinite(elapsedMinutes) ||
    elapsedMinutes <= 0 ||
    elapsedMinutes >= profile.durationMinutes
  )
    return 0;
  if (profile.role === "basal") {
    const entry = profile.onsetMinutes || 60;
    const tail = Math.min(180, profile.durationMinutes / 8);
    if (elapsedMinutes < entry) return smooth(elapsedMinutes / entry) * 100;
    if (elapsedMinutes > profile.durationMinutes - tail)
      return smooth((profile.durationMinutes - elapsedMinutes) / tail) * 100;
    return 100;
  }
  const onset = profile.onsetMinutes ?? 0;
  const peak = profile.peakMinutes ?? onset;
  if (elapsedMinutes <= onset) return 0;
  if (elapsedMinutes <= peak) {
    return smooth((elapsedMinutes - onset) / (peak - onset)) * 100;
  }
  return (
    smooth((profile.durationMinutes - elapsedMinutes) / (profile.durationMinutes - peak)) * 100
  );
}

export function demoActionApplications(
  admins: InsulinAdministration[],
  catalog: InsulinCatalogItem[],
  profiles?: InsulinActionProfile[],
  allowReferenceFallback = profiles === undefined,
) {
  return admins.flatMap((a) => {
    const item = catalog.find((c) => c.id === a.insulin_id);
    const stored = profiles?.find((p) => p.insulin_id === a.insulin_id);
    const parsed = visualProfileSchema.safeParse(stored?.visual_profile);
    const profile: DemoInsulinProfile | null =
      parsed.success && stored?.source_reference
        ? {
            ...parsed.data,
            name: item?.brand_name ?? "Insulina",
            onsetText: stored.onset_text ?? "Ilustrativo",
            peakText: stored.peak_text ?? "Ilustrativo",
            durationText: stored.effective_duration_text ?? "Ilustrativo",
            source: stored.source_reference,
            sourceLabel: "Fonte cadastrada",
          }
        : allowReferenceFallback
          ? demoInsulinProfile(item)
          : null;
    const start = new Date(a.administered_at).getTime();
    if (
      !profile ||
      a.status !== "performed" ||
      !a.confirmed_by_user ||
      a.deleted_at ||
      a.is_superseded ||
      !Number.isFinite(start) ||
      !Number.isFinite(a.dose_units) ||
      a.dose_units <= 0
    )
      return [];
    return [
      {
        administration: a,
        profile,
        start,
        end: start + profile.durationMinutes * 60000,
        peak: profile.peakMinutes == null ? null : start + profile.peakMinutes * 60000,
      },
    ];
  });
}

export function demoActionSeries(
  applications: ReturnType<typeof demoActionApplications>,
  from: number,
  to: number,
) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  // Include exact application/peak boundaries so the drawn landmarks do not shift with sampling.
  const times = new Set<number>([from, to]);
  for (let i = 1; i < 216; i++) times.add(from + ((to - from) * i) / 216);
  for (const a of applications) {
    for (const t of [
      a.start,
      a.end,
      a.peak,
      a.profile.onsetMinutes == null ? null : a.start + a.profile.onsetMinutes * 60000,
    ]) {
      if (t != null && t >= from && t <= to) times.add(t);
    }
  }
  return [...times]
    .sort((a, b) => a - b)
    .map((ts) => {
      const point: Record<string, number> = { ts };
      for (const a of applications)
        point[a.administration.id] = illustrativeAction(a.profile, (ts - a.start) / 60000);
      return point;
    });
}
