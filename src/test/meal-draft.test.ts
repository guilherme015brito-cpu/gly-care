import { beforeEach, describe, expect, it } from "vitest";
import { clearMealDraft, readMealDraft, writeMealDraft } from "@/lib/data/meal-draft";
beforeEach(() => localStorage.clear());
describe("Meal draft storage", () => {
  it("preserves separate fields without overwriting the rest", () => {
    writeMealDraft("cloud:user:patient", "notes", "Almoço");
    writeMealDraft("cloud:user:patient", "scenarioGlucose", "123");
    expect(readMealDraft("cloud:user:patient")).toEqual({
      notes: "Almoço",
      scenarioGlucose: "123",
    });
    clearMealDraft("cloud:user:patient");
    expect(readMealDraft("cloud:user:patient")).toEqual({});
  });
  it("isolates users, patients and modes", () => {
    writeMealDraft("cloud:a:x", "notes", "privado");
    for (const key of ["cloud:b:x", "cloud:a:y", "demo:a:x"])
      expect(readMealDraft(key)).toEqual({});
  });
  it("does not silently overwrite a malformed draft", () => {
    localStorage.setItem("glycare-meal-draft-v1:broken", '{"lines":false}');
    expect(() => readMealDraft("broken")).toThrow();
    expect(() => writeMealDraft("broken", "notes", "new")).toThrow();
    expect(localStorage.getItem("glycare-meal-draft-v1:broken")).toBe('{"lines":false}');
  });
});
