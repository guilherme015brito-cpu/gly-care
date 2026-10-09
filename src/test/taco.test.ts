import { describe, expect, it } from "vitest";
import taco from "@/lib/taco_glycare.json";
import { tacoFoods } from "@/lib/taco-foods";
import { computeItem, sumItems } from "@/lib/nutrition";

const byName = (name: string) => tacoFoods.find((food) => food.name === name)!;

describe("TACO local", () => {
  it("loads all 597 foods with unique local IDs and preserves every Food field", () => {
    expect(tacoFoods).toHaveLength(597);
    expect(new Set(tacoFoods.map((food) => food.id)).size).toBe(597);
    for (const [index, food] of tacoFoods.entries()) {
      const original = taco.alimentos[index]!;
      for (const field of Object.keys(food) as Array<keyof typeof food>) {
        expect(food[field]).toEqual(original[field]);
      }
      expect(food.source).toBe("TACO");
      expect(food.patient_id).toBeNull();
      expect(["raw", "cooked", "not_applicable"]).toContain(food.state);
    }
  });

  it.each(["arroz", "feijão", "frango"])("finds %s by the original name", (query) => {
    expect(
      tacoFoods.filter((food) => food.name.toLowerCase().includes(query)).length,
    ).toBeGreaterThan(0);
  });

  it("keeps raw and cooked rice distinct", () => {
    expect(byName("Arroz, tipo 1, cru").carbs_per_100g).toBe(78.8);
    expect(byName("Arroz, tipo 1, cozido").carbs_per_100g).toBe(28.1);
    expect(byName("Arroz, tipo 1, cru").state).toBe("raw");
    expect(byName("Arroz, tipo 1, cozido").state).toBe("cooked");
  });

  it.each([100, 80, 30])("matches all source nutrients for every food at %i g", (grams) => {
    const fields = {
      carbs_g: "carbs_per_100g",
      protein_g: "protein_per_100g",
      fat_g: "fat_per_100g",
      kcal: "kcal_per_100g",
    } as const;
    for (const [index, food] of tacoFoods.entries()) {
      const item = computeItem(food, grams);
      for (const field of Object.keys(fields) as Array<keyof typeof fields>) {
        const original = taco.alimentos[index]![fields[field]];
        expect(item[field]).toBe(
          original == null ? null : Math.round(((original * grams) / 100) * 10) / 10,
        );
      }
    }
  });

  it("sums 100 g rice, 80 g beans and 30 g chicken", () => {
    const items = [
      computeItem(byName("Arroz, tipo 1, cozido"), 100),
      computeItem(byName("Feijão, carioca, cozido"), 80),
      computeItem(byName("Frango, peito, sem pele, cozido"), 30),
    ];
    expect(items.map((item) => item.carbs_g)).toEqual([28.1, 10.9, 0]);
    expect(sumItems(items)).toEqual({
      carbs_g: 39,
      protein_g: 15.8,
      fat_g: 1.6,
      kcal: 237.7,
      hasMissing: false,
      missingFields: [],
    });
  });

  it("does not present partial or entirely missing carbs as a valid total", () => {
    const missing = computeItem(byName("Azeite, de oliva, extra virgem"), 30);
    const rice = computeItem(byName("Arroz, tipo 1, cozido"), 100);
    expect(missing.carbs_g).toBeNull();
    expect(sumItems([rice, missing])).toMatchObject({
      carbs_g: null,
      protein_g: null,
      hasMissing: true,
    });
    expect(sumItems([missing]).carbs_g).toBeNull();
    expect(sumItems([rice, missing]).missingFields).toEqual(["carbs", "protein"]);
  });
});
