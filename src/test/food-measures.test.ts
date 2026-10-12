import { describe, expect, it } from "vitest";
import { foodMeasures, measureGrams, normalizePortionNutrient } from "@/lib/food-measures";
import { tacoFoods } from "@/lib/taco-foods";
import { computeItem } from "@/lib/nutrition";
import type { Food } from "@/lib/domain/types";
const rice = tacoFoods.find((f) => f.name === "Arroz, tipo 1, cozido")!;
describe("Registered and household portions", () => {
  it("scales two and fractional units of a 200 g portion", () => {
    const f: Food = {
      ...rice,
      source: "manual",
      portion_amount: 200,
      portion_unit: "g",
      portion_grams: 200,
      carbs_per_100g: 15,
    };
    expect(normalizePortionNutrient("30", 200)).toBe("15");
    expect(computeItem(f, measureGrams(f, "1", "portion")).carbs_g).toBe(30);
    expect(computeItem(f, measureGrams(f, "2", "portion")).carbs_g).toBe(60);
    expect(computeItem(f, measureGrams(f, "0,5", "portion")).carbs_g).toBe(15);
  });
  it("uses the registered mass for 200 ml instead of assuming water density", () => {
    const f: Food = {
      ...rice,
      source: "manual",
      portion_amount: 200,
      portion_unit: "ml",
      portion_grams: 250,
      carbs_per_100g: 8,
    };
    expect(normalizePortionNutrient("20", 250)).toBe("8");
    expect(measureGrams(f, "1", "portion")).toBe(250);
    expect(computeItem(f, measureGrams(f, "100", "ml")).carbs_g).toBe(10);
  });
  it("maps household weights to original TACO nutrients only for supported preparations", () => {
    expect(measureGrams(rice, "2", "spoon")).toBe(40);
    expect(computeItem(rice, 40).carbs_g).toBe(11.2);
    const beans = tacoFoods.find((f) => f.name === "Feijão, preto, cozido")!;
    expect(measureGrams(beans, "1", "full-ladle")).toBe(140);
    expect(foodMeasures({ ...rice, name: "Arroz, tipo 1, cru" })).toHaveLength(1);
    expect(foodMeasures({ ...rice, source: "manual" })).toHaveLength(1);
  });
  it("rejects invalid quantities and preserves missing nutrients", () => {
    for (const q of ["", "-1", "1e3", "NaN", "Infinity", "0", "1g"])
      expect(measureGrams(rice, q)).toBeNaN();
    expect(measureGrams(rice, "1", "unknown")).toBeNaN();
    expect(normalizePortionNutrient("", 200)).toBe("");
    expect(normalizePortionNutrient("-2", 200)).toBe("inválido");
  });
});
