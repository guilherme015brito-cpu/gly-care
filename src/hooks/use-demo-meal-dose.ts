import { useMealDraftState } from "./use-meal-draft";
import { usePatientStore } from "@/lib/app-context";
import { calculateDemoDose, decimal, demoParameters } from "@/lib/demo-dose";
import { useGlucose, useSettings } from "./use-data";
import type { MealType } from "@/lib/domain/types";

export function useDemoMealDose(
  carbs: number | null,
  at: string,
  complete: boolean,
  mealType?: MealType,
) {
  const { mode } = usePatientStore();
  const glucose = useGlucose(24);
  const settings = useSettings();
  const [increment, setIncrement] = useMealDraftState("increment", 0.5);
  const [scenarioGlucose, setScenarioGlucose] = useMealDraftState("scenarioGlucose", "");
  const reading = glucose.data?.filter((r) => r.quality !== "invalid").at(-1);
  const parameters = settings.data ? demoParameters(settings.data, new Date(at), mealType) : null;
  const result =
    complete &&
    !settings.error &&
    parameters &&
    !("error" in parameters) &&
    parameters.kind === "meal"
      ? calculateDemoDose(
          carbs,
          decimal(scenarioGlucose),
          parameters.target,
          parameters.sensitivity,
          parameters.ratio,
          increment,
        )
      : null;
  return {
    carbs,
    at,
    complete,
    reading,
    parameters,
    result,
    increment,
    setIncrement,
    scenarioGlucose,
    setScenarioGlucose,
    isLoading: glucose.isLoading || settings.isLoading,
    error: settings.error,
    readingError: glucose.error,
  };
}

export type DemoMealDoseState = ReturnType<typeof useDemoMealDose>;
