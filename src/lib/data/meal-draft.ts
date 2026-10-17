import { z } from "zod";
const food = z
  .object({
    id: z.string(),
    name: z.string(),
    source: z.string(),
    state: z.string(),
    edible_portion_pct: z.number(),
  })
  .passthrough();
const schema = z.object({
  q: z.string().optional(),
  notes: z.string().optional(),
  favName: z.string().optional(),
  insulinId: z.string().optional(),
  manualDose: z.string().optional(),
  injectionSite: z.string().optional(),
  scenarioGlucose: z.string().optional(),
  eatenAt: z.string().optional(),
  appliedAt: z.string().optional(),
  fav: z.boolean().optional(),
  increment: z.number().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "supper", "other"]).optional(),
  lines: z
    .array(
      z.object({
        key: z.string(),
        food,
        grams: z.string(),
        includesInedible: z.boolean(),
        measure: z.string().optional(),
      }),
    )
    .optional(),
  pending: z
    .object({
      meal: z
        .object({
          items: z.array(z.object({}).passthrough()),
          totals: z.object({ carbs_g: z.number() }).passthrough(),
          meal_type: z.string(),
          eaten_at: z.string(),
        })
        .passthrough(),
      dose: z.number(),
      glucose: z.number().nullable(),
      purpose: z.enum(["meal", "combined"]),
      requestId: z.string(),
    })
    .nullable()
    .optional(),
});
const errors = new Set<string>();
const pendingWrites = new Map<string, Record<string, unknown>>();
export function draftHasError(scope: string) {
  return errors.has(scope);
}
export function draftStatus(scope: string, failed: boolean) {
  if (failed) errors.add(scope);
  else errors.delete(scope);
  window.dispatchEvent(new Event("glycare-draft-status"));
}
/** Only unfinished form input is retained. This is not a clinical/offline record cache. */
export function readMealDraft(scope: string): Record<string, unknown> {
  const raw = localStorage.getItem(`glycare-meal-draft-v1:${scope}`);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Rascunho inválido. Não foi substituído.");
  return schema.parse(parsed);
}

export function writeMealDraft(scope: string, field: string, value: unknown) {
  const draft = readMealDraft(scope);
  const pending = { ...pendingWrites.get(scope), [field]: value };
  pendingWrites.set(scope, pending);
  localStorage.setItem(`glycare-meal-draft-v1:${scope}`, JSON.stringify({ ...draft, ...pending }));
  pendingWrites.delete(scope);
}

export function clearMealDraft(scope: string) {
  localStorage.removeItem(`glycare-meal-draft-v1:${scope}`);
  pendingWrites.delete(scope);
}
