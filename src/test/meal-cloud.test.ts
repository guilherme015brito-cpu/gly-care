import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock("@/lib/glucose/libre.functions", () => ({ libreRequest: vi.fn() }));
import { cloudStore } from "@/lib/data/cloud-store";
import type { NewMeal } from "@/lib/data/store";
import type { AdministrationInput } from "@/lib/validation";

const meal: NewMeal = {
  meal_type: "lunch",
  eaten_at: new Date().toISOString(),
  notes: null,
  is_favorite: false,
  favorite_name: null,
  items: [
    {
      food_id: "taco-003",
      food_name: "Arroz, tipo 1, cozido",
      food_source: "TACO",
      grams: 100,
      carbs_g: 28.1,
      protein_g: 2.5,
      fat_g: 0.2,
      kcal: 128,
    },
  ],
  totals: { carbs_g: 28.1, protein_g: 2.5, fat_g: 0.2, kcal: 128, hasMissing: false },
};
const admin: AdministrationInput = {
  insulin_id: "test-insulin",
  dose: 2.5,
  administered_at: new Date().toISOString(),
  purpose: "meal",
  status: "performed",
  confirmed: true,
  glucose_before: null,
  notes: null,
  injection_site: "Braço",
  recorded_by_name: "Manual",
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.rpc.mockResolvedValue({ data: "meal-id", error: null });
});
describe("Cloud meal + manual application", () => {
  it("sends one atomic request, preserving TACO text IDs and the supplied request ID", async () => {
    await cloudStore.addMealWithAdministration("patient", meal, admin, "request");
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith(
      "save_meal_with_administration",
      expect.objectContaining({
        p_patient_id: "patient",
        p_request_id: "request",
        p_items: meal.items,
        p_administration: admin,
      }),
    );
  });
  it("rejects missing confirmation and incomplete nutrients before writing", async () => {
    await expect(
      cloudStore.addMealWithAdministration("patient", meal, { ...admin, confirmed: false }),
    ).rejects.toThrow("Confirme");
    await expect(
      cloudStore.addMealWithAdministration(
        "patient",
        { ...meal, items: [{ ...meal.items[0]!, carbs_g: null }] },
        admin,
      ),
    ).rejects.toThrow("incompletos");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("propagates a permission failure instead of claiming success", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
    await expect(cloudStore.addMealWithAdministration("patient", meal, admin)).rejects.toThrow(
      "permissão",
    );
  });
});
