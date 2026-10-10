import taco from "./taco_glycare.json";
import type { Food } from "./domain/types";

// Preserve the source names, preparations and missing nutrients without estimates.
export const tacoFoods: Food[] = taco.alimentos.map((food) => ({
  id: food.id,
  name: food.name,
  preparation: food.preparation,
  state: food.state as Food["state"],
  source: food.source as Food["source"],
  source_reference: food.source_reference,
  carbs_per_100g: food.carbs_per_100g,
  protein_per_100g: food.protein_per_100g,
  fat_per_100g: food.fat_per_100g,
  kcal_per_100g: food.kcal_per_100g,
  edible_portion_pct: food.edible_portion_pct,
  is_favorite: food.is_favorite,
  patient_id: food.patient_id,
}));
