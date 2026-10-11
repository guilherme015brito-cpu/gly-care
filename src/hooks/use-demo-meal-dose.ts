import { useState } from "react";
import { usePatientStore } from "@/lib/app-context";
import { calculateDemoDose, demoParameters } from "@/lib/demo-dose";
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
  const settings = useSettings(mode === "demo");
  const [increment, setIncrement] = useState(0.5);
  const reading = glucose.data?.filter((r) => r.quality !== "invalid").at(-1);
  const parameters = settings.data ? demoParameters(settings.data, new Date(at), mealType) : null;
  const result =
    mode === "demo" &&
    complete &&
    !glucose.error &&
    !settings.error &&
    parameters &&
    !("error" in parameters) &&
    parameters.kind === "meal" &&
    reading &&
    reading.source !== "external"
      ? calculateDemoDose(
          carbs,
          reading.value_mgdl,
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
    isLoading: glucose.isLoading || settings.isLoading,
    error: glucose.error ?? settings.error,
  };
}

export type DemoMealDoseState = ReturnType<typeof useDemoMealDose>;
