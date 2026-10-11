import type { CarbRatio, MealType } from "./domain/types";

export function decimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function minutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function carbsPerUnit(value: string): number | null {
  const match = value.trim().match(/^1\s*(?:UI|U)?\s*:\s*(\d+(?:[.,]\d+)?)\s*g?$/i);
  return match ? decimal(match[1]!) : decimal(value);
}

export function sensitivityPerUnit(value: string): number | null {
  return decimal(value.replace(/\s*mg\/dL(?:\s*\/\s*(?:UI|U))?\s*$/i, ""));
}

const meals: MealType[] = ["breakfast", "lunch", "snack", "dinner", "supper", "other"];

function ranges(period: CarbRatio): [number, number][] {
  const start = minutes(period.from),
    end = minutes(period.to);
  if (start == null || end == null || start === end) return [];
  return start < end
    ? [[start, end]]
    : [
        [start, 1440],
        [0, end],
      ];
}

export function validateDosePeriods(periods: CarbRatio[]): string | null {
  if (periods.length > 48) return "Cadastre no máximo 48 faixas.";
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]!;
    const ratio = carbsPerUnit(p.ratio_text);
    if (!ranges(p).length) return "Informe horários válidos e diferentes para cada faixa.";
    if (ratio == null || ratio <= 0 || p.ratio_text.length > 60)
      return "Informe carboidratos por UI maiores que zero em cada faixa.";
    if (p.sensitivity_text !== undefined) {
      const sensitivity = sensitivityPerUnit(p.sensitivity_text);
      if (sensitivity == null || sensitivity <= 0 || p.sensitivity_text.length > 60)
        return "Informe sensibilidade em mg/dL por UI maior que zero em cada faixa.";
    }
    if (p.meal_type !== undefined && !meals.includes(p.meal_type))
      return "Selecione uma refeição válida.";
    for (const other of periods.slice(0, i)) {
      if (p.meal_type && p.meal_type === other.meal_type)
        return "Cadastre apenas uma faixa para cada tipo de refeição.";
      if (ranges(p).some(([start, end]) => ranges(other).some(([a, b]) => start < b && a < end)))
        return "As faixas de horário não podem se sobrepor.";
    }
  }
  return null;
}

export function matchingDosePeriods(periods: CarbRatio[], at: Date, mealType?: MealType) {
  if (!Number.isFinite(at.getTime())) return [];
  const named = mealType ? periods.filter((p) => p.meal_type === mealType) : [];
  if (named.length) return named;
  const time = at.getHours() * 60 + at.getMinutes();
  return periods.filter((p) => ranges(p).some(([start, end]) => time >= start && time < end));
}
