import type { InsulinAdministration } from "./domain/types";

export const INJECTION_SITES = ["Braço", "Perna (coxa)", "Abdômen", "Nádega"] as const;
export type InjectionSite = (typeof INJECTION_SITES)[number];
export type InjectionContext = { previous: (string | null)[]; following: (string | null)[] };
export function normalizeInjectionSite(value: string | null | undefined): InjectionSite | null {
  const s = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (/^braco(?:\b|$)/.test(s)) return "Braço";
  if (/^(perna|coxa)(?:\b|$)/.test(s)) return "Perna (coxa)";
  if (/^(abdomen|abdome|barriga)(?:\b|$)/.test(s)) return "Abdômen";
  if (/^(nadega|gluteo)(?:\b|$)/.test(s)) return "Nádega";
  return null;
}
export function injectionContext(
  rows: InsulinAdministration[],
  pid: string,
  at: string,
  excludeId?: string,
): InjectionContext {
  const time = new Date(at).getTime();
  const active = rows
    .filter(
      (a) =>
        a.patient_id === pid &&
        a.id !== excludeId &&
        !a.deleted_at &&
        !a.is_superseded &&
        a.status === "performed" &&
        a.confirmed_by_user,
    )
    .sort(
      (a, b) =>
        Date.parse(b.administered_at) - Date.parse(a.administered_at) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  return {
    previous: active
      .filter((a) => Date.parse(a.administered_at) <= time)
      .slice(0, 3)
      .map((a) => a.injection_site),
    following: active
      .filter((a) => Date.parse(a.administered_at) > time)
      .reverse()
      .slice(0, 3)
      .map((a) => a.injection_site),
  };
}
export function siteRotation(context: InjectionContext, site: string) {
  const normalized = normalizeInjectionSite(site);
  const count = (sites: (string | null)[]) => {
    let n = 0;
    for (const s of sites) {
      if (!normalized || normalizeInjectionSite(s) !== normalized) break;
      n++;
    }
    return n;
  };
  const previous = count(context.previous),
    following = count(context.following);
  return { previous, repeated: previous > 0, blocked: previous + following >= 3 };
}
export function requireInjectionSite(context: InjectionContext, site: string | null | undefined) {
  if (!INJECTION_SITES.includes(site as InjectionSite))
    throw new Error("Selecione o local da aplicação.");
  if (siteRotation(context, site!).blocked)
    throw new Error("Rodízio: três aplicações consecutivas nesta região. Selecione outro local.");
}
