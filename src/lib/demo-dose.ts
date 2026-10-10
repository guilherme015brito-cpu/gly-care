import type { ClinicalSettings } from "./domain/types";

export function decimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function minutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function demoCorrectionParameters(settings: ClinicalSettings) {
  const target = decimal((settings.target_glucose_text ?? "").replace(/\s*mg\/dL\s*$/i, ""));
  const sensitivity = decimal(
    (settings.sensitivity_factor_text ?? "").replace(/\s*mg\/dL(?:\s*\/\s*(?:UI|U))?\s*$/i, ""),
  );
  if (target == null || target < 0 || sensitivity == null || sensitivity <= 0) {
    return {
      error: "Preencha o alvo e um fator de sensibilidade maior que zero nas configurações.",
    } as const;
  }
  return { kind: "correction", target, sensitivity } as const;
}

export function demoParameters(settings: ClinicalSettings, at: Date) {
  const correction = demoCorrectionParameters(settings);
  if ("error" in correction) return correction;
  const t = at.getHours() * 60 + at.getMinutes();
  const matching = settings.carb_ratios.filter((r) => {
    const start = minutes(r.from),
      end = minutes(r.to);
    if (start == null || end == null || start === end || !Number.isFinite(at.getTime()))
      return false;
    return start < end ? t >= start && t < end : t >= start || t < end;
  });
  if (matching.length !== 1)
    return {
      error: "Configure uma única relação de carboidrato válida para este horário.",
    } as const;
  const band = matching[0]!;
  const ratioMatch = band.ratio_text.trim().match(/^1\s*(?:UI|U)?\s*:\s*(\d+(?:[.,]\d+)?)\s*g?$/i);
  const ratio = ratioMatch ? decimal(ratioMatch[1]!) : decimal(band.ratio_text);
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
