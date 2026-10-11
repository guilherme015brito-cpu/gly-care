import type { InsulinAdministration, InsulinCatalogItem } from "../domain/types";

export const DEMO_INSULIN_PROFILES = {
  fiasp: {
    name: "Fiasp",
    role: "rapid",
    onsetMinutes: 17,
    peakMinutes: 122,
    durationMinutes: 360,
    onsetText: "16–20 min",
    peakText: "91–133 min",
    durationText: "5–7 h",
    source: "https://www.novo-pi.com/fiasp.pdf",
    sourceLabel: "Novo Nordisk · bula, tabela 6",
  },
  lantus: {
    name: "Lantus",
    role: "basal",
    onsetMinutes: null,
    peakMinutes: null,
    durationMinutes: 1440,
    onsetText: "Absorção gradual",
    peakText: "Sem pico pronunciado",
    durationText: "Cerca de 24 h",
    source: "https://products.sanofi.us/lantus/lantus.html",
    sourceLabel: "Sanofi · bula, seção 12",
  },
} as const;

export type DemoInsulinProfile = (typeof DEMO_INSULIN_PROFILES)[keyof typeof DEMO_INSULIN_PROFILES];

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
 * The Fiasp landmarks use the label's 0.2 U/kg study, not the recorded dose.
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
    if (elapsedMinutes < 60) return smooth(elapsedMinutes / 60) * 100;
    if (elapsedMinutes > 1260) return smooth((1440 - elapsedMinutes) / 180) * 100;
    return 100;
  }
  if (elapsedMinutes <= profile.onsetMinutes) return 0;
  if (elapsedMinutes <= profile.peakMinutes) {
    return (
      smooth(
        (elapsedMinutes - profile.onsetMinutes) / (profile.peakMinutes - profile.onsetMinutes),
      ) * 100
    );
  }
  return (
    smooth(
      (profile.durationMinutes - elapsedMinutes) / (profile.durationMinutes - profile.peakMinutes),
    ) * 100
  );
}

export function demoActionApplications(
  admins: InsulinAdministration[],
  catalog: InsulinCatalogItem[],
) {
  return admins.flatMap((a) => {
    const profile = demoInsulinProfile(catalog.find((c) => c.id === a.insulin_id));
    const start = new Date(a.administered_at).getTime();
    if (
      !profile ||
      a.status !== "performed" ||
      !a.confirmed_by_user ||
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
