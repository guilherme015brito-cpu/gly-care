import { describe, it, expect } from "vitest";
import { ADDITIONAL_HOUSEHOLD } from "@/lib/household-measures";
import { foodMeasures, measureGrams } from "@/lib/food-measures";
import { tacoFoods } from "@/lib/taco-foods";
import { computeItem } from "@/lib/nutrition";
import { mealPlanSchema, plannedMealTotals } from "@/lib/meal-plans";

const get = (name: string) => tacoFoods.find((f) => f.name === name)!;
describe("Researched household measures", () => {
  it("matches every curated food exactly and keeps sourced, finite, unique measures", () => {
    for (const [name, measures] of Object.entries(ADDITIONAL_HOUSEHOLD)) {
      const food = get(name);
      expect(food, name).toBeDefined();
      const options = foodMeasures(food);
      expect(new Set(options.map((m) => m.id)).size).toBe(options.length);
      for (const m of measures) {
        expect(m.grams).toBeGreaterThan(0);
        expect(Number.isFinite(m.grams)).toBe(true);
        expect(m.sourceUrl).toMatch(/^https:\/\/(diabetes.org.br|www.ibge.gov.br)\//);
        expect(measureGrams(food, "1", m.id)).toBe(m.grams);
      }
    }
  });
  it("uses edible weights specific to preparation and fruit size", () => {
    expect(measureGrams(get("Ovo, de galinha, inteiro, cozido/10minutos"), "2", "unit")).toBe(90);
    expect(measureGrams(get("Ovo, de galinha, inteiro, frito"), "2", "unit")).toBe(100);
    expect(measureGrams(get("Banana, nanica, crua"), "0,5", "unit")).toBe(43);
    expect(measureGrams(get("Banana, prata, crua"), "1", "unit")).toBe(40);
    const bread = get("Pão, trigo, forma, integral");
    expect(computeItem(bread, measureGrams(bread, "2", "slice"))).toEqual(computeItem(bread, 50));
    expect(foodMeasures({ ...bread, name: "Pão desconhecido" })).toHaveLength(1);
    expect(foodMeasures({ ...bread, source: "manual" })).toHaveLength(1);
  });
  it("distinguishes an entire registered portion from one slice", () => {
    const food = {
      ...get("Pão, trigo, forma, integral"),
      portion_amount: 2,
      portion_grams: 50,
      portion_unit: "fatia" as const,
    };
    expect(measureGrams(food, "1", "portion")).toBe(50);
    expect(measureGrams(food, "1", "registered-unit")).toBe(25);
    expect(measureGrams(food, "3", "registered-unit")).toBe(75);
    expect(measureGrams({ ...food, portion_grams: Infinity }, "1", "registered-unit")).toBeNaN();
  });
  it("requires a user weight for yogurt ladles and preserves it through plan validation", () => {
    const yogurt = get("Iogurte, natural");
    expect(measureGrams(yogurt, "1", "ladle")).toBeNaN();
    const food = {
      ...yogurt,
      portion_amount: 1,
      portion_grams: 83,
      portion_unit: "concha" as const,
    };
    const input = {
      name: "Lanche",
      meals: [
        {
          id: crypto.randomUUID(),
          name: "Lanche",
          time: "15:00",
          meal_type: "snack",
          items: [
            {
              id: crypto.randomUUID(),
              food,
              measure: "registered-unit",
              quantity: "2",
              selected: true,
            },
          ],
        },
      ],
    };
    const parsed = mealPlanSchema.parse(JSON.parse(JSON.stringify(input)));
    expect(parsed.meals[0]!.items[0]!.food.portion_grams).toBe(83);
    expect(plannedMealTotals(parsed.meals[0]!).carbs_g).toBe(computeItem(yogurt, 166).carbs_g);
    expect(foodMeasures(yogurt).some((m) => m.id === "registered-unit")).toBe(false);
    input.meals[0]!.items[0]!.food.portion_grams = 0;
    expect(mealPlanSchema.safeParse(input).success).toBe(false);
  });
});
