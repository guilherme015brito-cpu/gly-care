import type { Food, MealItem } from "./domain/types";

export interface NutrientTotals {
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  kcal: number | null;
  /** true when at least one item lacked a value for some nutrient */
  hasMissing: boolean;
  missingFields: Array<"carbs" | "protein" | "fat" | "kcal">;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrient amount for a given weight.
 * Values in the catalog are per 100 g of the food *as registered* (raw or cooked).
 * `grams` is the weight informed by the user. If `includesInedible` is true
 * the user weighed the food including inedible parts (peel, bone) and the
 * edible portion percentage is applied. A null per-100g value stays null:
 * missing values are never invented.
 */
export function nutrientFor(
  per100g: number | null,
  grams: number,
  ediblePct = 100,
  includesInedible = false,
): number | null {
  if (per100g == null) return null;
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  const edibleGrams = includesInedible ? grams * (ediblePct / 100) : grams;
  return round1((per100g * edibleGrams) / 100);
}

export function computeItem(
  food: Food,
  grams: number,
  includesInedible = false,
): Omit<MealItem, "id"> {
  const pct = food.edible_portion_pct;
  return {
    food_id: food.id,
    food_name: food.name,
    food_source: food.source,
    grams,
    carbs_g: nutrientFor(food.carbs_per_100g, grams, pct, includesInedible),
    protein_g: nutrientFor(food.protein_per_100g, grams, pct, includesInedible),
    fat_g: nutrientFor(food.fat_per_100g, grams, pct, includesInedible),
    kcal: nutrientFor(food.kcal_per_100g, grams, pct, includesInedible),
  };
}

export function sumItems(items: Array<Pick<MealItem, "carbs_g" | "protein_g" | "fat_g" | "kcal">>): NutrientTotals {
  const missing = new Set<NutrientTotals["missingFields"][number]>();
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let kcal = 0;
  for (const it of items) {
    if (it.carbs_g == null) missing.add("carbs");
    else carbs += it.carbs_g;
    if (it.protein_g == null) missing.add("protein");
    else protein += it.protein_g;
    if (it.fat_g == null) missing.add("fat");
    else fat += it.fat_g;
    if (it.kcal == null) missing.add("kcal");
    else kcal += it.kcal;
  }
  return {
    carbs_g: missing.has("carbs") ? null : round1(carbs),
    protein_g: missing.has("protein") ? null : round1(protein),
    fat_g: missing.has("fat") ? null : round1(fat),
    kcal: missing.has("kcal") ? null : round1(kcal),
    hasMissing: missing.size > 0,
    missingFields: [...missing],
  };
}
