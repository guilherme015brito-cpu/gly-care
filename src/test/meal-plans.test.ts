import { describe, expect, it, beforeEach } from "vitest";
import {
  mealPlanSchema,
  plannedMealTotals,
  plannedMealCoverage,
  type MealPlanInput,
} from "@/lib/meal-plans";
import { tacoFoods } from "@/lib/taco-foods";
import { DEFAULT_SETTINGS } from "@/lib/domain/types";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
const rice = tacoFoods.find((f) => f.name === "Arroz, tipo 1, cozido")!;
function plan(): MealPlanInput {
  return {
    name: "Semana",
    meals: [
      {
        id: crypto.randomUUID(),
        name: "Almoço",
        time: "12:00",
        meal_type: "lunch",
        items: [
          { id: crypto.randomUUID(), food: rice, quantity: "2", measure: "spoon", selected: true },
        ],
      },
    ],
  };
}
const settings = {
  ...DEFAULT_SETTINGS,
  patient_id: "demo-patient",
  carb_ratios: [{ from: "11:00", to: "15:00", ratio_text: "1:10" }],
};
beforeEach(() => resetDemoStore());
describe("Meal plans", () => {
  it("converts portions, selections and quantities and uses the configured time band", () => {
    const meal = plan().meals[0]!;
    expect(plannedMealTotals(meal).carbs_g).toBe(11.2);
    expect(plannedMealCoverage(meal, settings).units).toBeCloseTo(1.12);
    meal.items[0]!.quantity = "3";
    expect(plannedMealTotals(meal).carbs_g).toBe(16.9);
    meal.items[0]!.selected = false;
    expect(plannedMealCoverage(meal, settings).units).toBeNull();
  });
  it("never substitutes missing carbs, invalid quantity or missing/ambiguous ratios with a dose", () => {
    const meal = plan().meals[0]!;
    expect(plannedMealCoverage(meal, { ...settings, carb_ratios: [] }).units).toBeNull();
    expect(
      plannedMealCoverage(meal, {
        ...settings,
        carb_ratios: [...settings.carb_ratios, ...settings.carb_ratios],
      }).units,
    ).toBeNull();
    meal.items[0]!.quantity = "abc";
    expect(plannedMealTotals(meal).carbs_g).toBeNull();
    meal.items[0]!.quantity = "1";
    meal.items[0]!.food = { ...rice, carbs_per_100g: null };
    expect(plannedMealCoverage(meal, settings).units).toBeNull();
  });
  it("validates nested plans and saves edits with version checks without creating meals or applications", async () => {
    const s = getDemoStore(),
      pid = "demo-patient";
    await s.listPatients();
    const beforeMeals = (await s.listMeals(pid)).length,
      beforeAdmins = (await s.listAdministrations(pid)).length;
    const input = plan();
    expect(mealPlanSchema.safeParse(input).success).toBe(true);
    expect(mealPlanSchema.safeParse({ ...input, meals: [] }).success).toBe(false);
    const first = await s.saveMealPlan(pid, input, crypto.randomUUID(), 0);
    const edited = await s.saveMealPlan(pid, { ...input, name: "Novo nome" }, first.id, 1);
    expect(edited.version).toBe(2);
    await expect(s.saveMealPlan(pid, input, first.id, 1)).rejects.toThrow("outra sessão");
    await expect(s.saveMealPlan("other", input, first.id, 2)).rejects.toThrow();
    expect((await s.listMealPlans(pid))[0]!.name).toBe("Novo nome");
    await s.deleteMealPlan(pid, first.id, 2);
    expect(await s.listMealPlans(pid)).toEqual([]);
    expect(await s.listMeals(pid)).toHaveLength(beforeMeals);
    expect(await s.listAdministrations(pid)).toHaveLength(beforeAdmins);
  });
});
