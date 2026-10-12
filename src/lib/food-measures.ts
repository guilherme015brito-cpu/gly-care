import type { Food } from "./domain/types";

export const PORTION_UNITS = {
  g: "g",
  ml: "ml",
  colher: "colher",
  colher_sopa: "colher de sopa",
  concha: "concha",
} as const;
const SOURCE = "SBD, Manual de Contagem de Carboidratos 2023 · peso aproximado";
export const MEASURE_SOURCE_URL =
  "https://diabetes.org.br/wp-content/uploads/2023/10/manual-contagem-carboidratos2023.pdf";
export interface FoodMeasure {
  id: string;
  label: string;
  grams: number;
  source: string;
}
// Explicit food/preparation matches only; no universal spoon-to-grams conversion.
const spoon = (grams: number): FoodMeasure => ({
  id: "spoon",
  label: `Colher de sopa cheia (≈ ${grams} g)`,
  grams,
  source: SOURCE,
});
const ladle = (grams: number): FoodMeasure => ({
  id: "ladle",
  label: `Concha média rasa (≈ ${grams} g)`,
  grams,
  source: SOURCE,
});
const HOUSEHOLD: Record<string, FoodMeasure[]> = {
  "Arroz, tipo 1, cozido": [
    spoon(20),
    { id: "serving", label: "Colher de servir (≈ 45 g)", grams: 45, source: SOURCE },
  ],
  "Arroz, tipo 2, cozido": [
    spoon(20),
    { id: "serving", label: "Colher de servir (≈ 45 g)", grams: 45, source: SOURCE },
  ],
  "Arroz, integral, cozido": [spoon(20)],
  "Feijão, carioca, cozido": [spoon(17), ladle(80)],
  "Feijão, preto, cozido": [
    spoon(17),
    ladle(80),
    { id: "full-ladle", label: "Concha média cheia (≈ 140 g)", grams: 140, source: SOURCE },
  ],
  "Feijão, fradinho, cozido": [spoon(17)],
};

export function foodMeasures(food: Food): FoodMeasure[] {
  const result: FoodMeasure[] = [
    { id: "g", label: "Gramas (g)", grams: 1, source: "Peso informado" },
  ];
  if (food.portion_grams && food.portion_amount && food.portion_unit) {
    result.push({
      id: "portion",
      label: `Unidade (${food.portion_amount} ${PORTION_UNITS[food.portion_unit]})`,
      grams: food.portion_grams,
      source: "Porção cadastrada",
    });
    if (food.portion_unit === "ml")
      result.push({
        id: "ml",
        label: "Mililitros (ml)",
        grams: food.portion_grams / food.portion_amount,
        source: "Relação peso/volume cadastrada",
      });
  }
  if (food.source === "TACO") result.push(...(HOUSEHOLD[food.name] ?? []));
  return result;
}

export function measureGrams(food: Food, quantity: string, measure = "g"): number {
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(quantity.trim())) return NaN;
  const unit = foodMeasures(food).find((m) => m.id === measure);
  const n = Number(quantity.replace(",", "."));
  if (!unit || !Number.isFinite(n) || n <= 0) return NaN;
  return Math.round(n * unit.grams * 10) / 10;
}

export function normalizePortionNutrient(value: string, grams: number): string {
  if (!value.trim()) return "";
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(value.trim()) || !Number.isFinite(grams) || grams <= 0)
    return "inválido";
  return String(Math.round(((Number(value.replace(",", ".")) * 100) / grams) * 100) / 100);
}
