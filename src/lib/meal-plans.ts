import { z } from "zod";
import type { ClinicalSettings } from "./domain/types";
import { foodMeasures, measureGrams } from "./food-measures";
import { computeItem, sumItems } from "./nutrition";
import { carbsPerUnit, matchingDosePeriods, minutes } from "./dose-periods";

const nutrient = z.number().finite().nonnegative().max(10000).nullable();
const foodSchema = z.object({
  id: z.string().min(1).max(150),
  patient_id: z.string().nullable(),
  name: z.string().trim().min(1).max(500),
  preparation: z.string().nullable(),
  state: z.enum(["raw", "cooked", "not_applicable"]),
  source: z.enum(["fictional_example", "manual", "recipe", "TACO", "TBCA"]),
  source_reference: z.string().nullable(),
  carbs_per_100g: nutrient,
  protein_per_100g: nutrient,
  fat_per_100g: nutrient,
  kcal_per_100g: nutrient,
  edible_portion_pct: z.number().positive().max(100),
  is_favorite: z.boolean(),
  portion_amount: z.number().positive().optional(),
  portion_grams: z.number().positive().optional(),
  portion_unit: z.enum(["g", "ml", "colher", "colher_sopa", "concha"]).optional(),
});
const itemSchema = z
  .object({
    id: z.string().uuid(),
    food: foodSchema,
    quantity: z.string().max(12),
    measure: z.string().max(40),
    selected: z.boolean(),
  })
  .superRefine((item, ctx) => {
    const grams = measureGrams(item.food, item.quantity, item.measure);
    if (
      !Number.isFinite(grams) ||
      grams <= 0 ||
      grams > 10000 ||
      !foodMeasures(item.food).some((m) => m.id === item.measure)
    )
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Informe uma quantidade válida (até 10.000 g).",
      });
  });
const mealSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome da refeição.").max(80),
  time: z.string().refine((t) => minutes(t) !== null, "Informe um horário válido."),
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner", "supper", "other"]),
  items: z.array(itemSchema).min(1, "Adicione alimentos à refeição.").max(50),
});
export const mealPlanSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do cardápio.").max(100),
    meals: z.array(mealSchema).min(1, "Adicione uma refeição.").max(24),
  })
  .superRefine((p, ctx) => {
    const ids = [...p.meals.map((m) => m.id), ...p.meals.flatMap((m) => m.items.map((i) => i.id))];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Itens duplicados no plano." });
  });
export type MealPlanInput = z.infer<typeof mealPlanSchema>;
export type PlannedMeal = MealPlanInput["meals"][number];
export type PlannedItem = PlannedMeal["items"][number];
export interface MealPlan extends MealPlanInput {
  id: string;
  patient_id: string;
  version: number;
  updated_at: string;
}

export function plannedMealTotals(meal: PlannedMeal) {
  const selected = meal.items.filter((i) => i.selected);
  const valid = selected.every((i) => itemSchema.safeParse(i).success);
  const totals = sumItems(
    valid
      ? selected.map((i) => computeItem(i.food, measureGrams(i.food, i.quantity, i.measure)))
      : [],
  );
  return {
    ...totals,
    carbs_g: valid && selected.length ? totals.carbs_g : null,
    valid,
    selectedCount: selected.length,
  };
}
/** Food coverage only; no glucose import, correction, IOB, or clinical write. */
export function plannedMealCoverage(meal: PlannedMeal, settings: ClinicalSettings | undefined) {
  const totals = plannedMealTotals(meal);
  if (totals.carbs_g == null)
    return {
      units: null,
      ratio: null,
      message: "Selecione alimentos com quantidade e carboidratos completos.",
    };
  if (!settings || minutes(meal.time) == null)
    return {
      units: null,
      ratio: null,
      message: "Configure a relação de carboidratos para calcular a estimativa.",
    };
  const at = new Date(2000, 0, 1, Number(meal.time.slice(0, 2)), Number(meal.time.slice(3)));
  const matching = matchingDosePeriods(settings.carb_ratios, at, meal.meal_type);
  const ratio = matching.length === 1 ? carbsPerUnit(matching[0]!.ratio_text) : null;
  if (ratio == null || ratio <= 0)
    return {
      units: null,
      ratio: null,
      message: "Configure uma única relação de carboidratos válida para esta refeição ou horário.",
    };
  const units = totals.carbs_g / ratio;
  if (!Number.isFinite(units) || units > 300)
    return {
      units: null,
      ratio,
      message: "Revise as quantidades e a relação de carboidratos configurada.",
    };
  return { units, ratio, message: null };
}
