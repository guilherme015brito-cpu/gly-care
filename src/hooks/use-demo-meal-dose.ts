import { useState } from "react";
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
  const glucose = useGlucose(24, mode === "demo");
  const settings = useSettings();
  const [increment, setIncrement] = useState(0.5);
  const [scenarioGlucose, setScenarioGlucose] = useState("");
  const reading =
    mode === "demo" ? glucose.data?.filter((r) => r.quality !== "invalid").at(-1) : undefined;
  const parameters = settings.data ? demoParameters(settings.data, new Date(at), mealType) : null;
  const result =
    complete &&
    !glucose.error &&
    !settings.error &&
    parameters &&
    !("error" in parameters) &&
    parameters.kind === "meal" &&
    (mode === "cloud" || (reading && reading.source !== "external"))
      ? calculateDemoDose(
          carbs,
          mode === "cloud" ? decimal(scenarioGlucose) : reading!.value_mgdl,
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
    error: glucose.error ?? settings.error,
  };
}

export type DemoMealDoseState = ReturnType<typeof useDemoMealDose>;
