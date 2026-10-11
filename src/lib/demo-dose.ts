import type { ClinicalSettings, MealType } from "./domain/types";
import { decimal, carbsPerUnit, sensitivityPerUnit, matchingDosePeriods } from "./dose-periods";
export { decimal } from "./dose-periods";

export function demoCorrectionParameters(
  settings: ClinicalSettings,
  at?: Date,
  mealType?: MealType,
) {
  const target = decimal((settings.target_glucose_text ?? "").replace(/\s*mg\/dL\s*$/i, ""));
  const scheduled = settings.carb_ratios.some((p) => p.sensitivity_text !== undefined);
  const matching = at ? matchingDosePeriods(settings.carb_ratios, at, mealType) : [];
  if (at && (!Number.isFinite(at.getTime()) || (scheduled && matching.length !== 1)))
    return {
      error: "Configure uma única faixa de sensibilidade válida para este horário ou refeição.",
    } as const;
  const band = scheduled && at ? matching[0] : undefined;
  const sensitivity = sensitivityPerUnit(
    band?.sensitivity_text ?? settings.sensitivity_factor_text ?? "",
  );
  if (target == null || target < 0 || sensitivity == null || sensitivity <= 0) {
    return {
      error: "Preencha o alvo e um fator de sensibilidade maior que zero nas configurações.",
    } as const;
  }
  return { kind: "correction", target, sensitivity, band } as const;
}

export function demoParameters(settings: ClinicalSettings, at: Date, mealType?: MealType) {
  const correction = demoCorrectionParameters(settings, at, mealType);
  if ("error" in correction) return { error: correction.error } as const;
  const matching = matchingDosePeriods(settings.carb_ratios, at, mealType);
  if (matching.length !== 1)
    return {
      error: "Configure uma única relação de carboidrato válida para este horário.",
    } as const;
  const band = matching[0]!;
  const ratio = carbsPerUnit(band.ratio_text);
  if (ratio == null || ratio <= 0)
    return { error: "Revise os parâmetros numéricos da demonstração nas configurações." } as const;
  return { ...correction, kind: "meal", ratio, band } as const;
}

export function calculateDemoDose(
  carbs: number | null,
  glucose: number | null,
  target: number,
  sensitivity: number,
  ratio: number,
  increment: number,
) {
  if (
    carbs == null ||
    glucose == null ||
    ![carbs, glucose, target, sensitivity, ratio, increment].every(Number.isFinite) ||
    carbs < 0 ||
    glucose < 0 ||
    target < 0 ||
    sensitivity <= 0 ||
    ratio <= 0 ||
    increment < 0
  )
    return null;
  const meal = carbs / ratio;
  const correction = Math.max(0, (glucose - target) / sensitivity);
  const total = meal + correction;
  const rounded = increment === 0 ? total : Math.round(total / increment) * increment;
  if (![meal, correction, total, rounded].every(Number.isFinite)) return null;
  return { meal, correction, total, rounded };
}

export function calculateDemoCorrection(
  glucose: number | null,
  target: number,
  sensitivity: number,
  increment: number,
) {
  return calculateDemoDose(0, glucose, target, sensitivity, 1, increment);
}
