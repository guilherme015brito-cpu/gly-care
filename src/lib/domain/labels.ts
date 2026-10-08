import type {
  AdministrationPurpose,
  FoodSource,
  FoodState,
  GlucoseSource,
  GlucoseTrend,
  KetoneQualitative,
  MealType,
  MemberRole,
  ValidationStatus,
} from "./types";

export const SOURCE_LABEL: Record<GlucoseSource, string> = {
  simulation: "Simulação",
  manual: "Entrada manual",
  external: "Integração externa",
};

export const TREND_LABEL: Record<GlucoseTrend, string> = {
  rising_fast: "Subindo rápido",
  rising: "Subindo",
  stable: "Estável",
  falling: "Descendo",
  falling_fast: "Descendo rápido",
  unknown: "Tendência não informada",
};

export const PURPOSE_LABEL: Record<AdministrationPurpose, string> = {
  basal: "Basal",
  meal: "Refeição",
  correction: "Correção",
  combined: "Refeição + correção",
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  supper: "Ceia",
  other: "Outros",
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  caregiver: "Responsável / cuidador",
  patient: "Paciente",
  professional_readonly: "Profissional de saúde (leitura)",
};

export const FOOD_SOURCE_LABEL: Record<FoodSource, string> = {
  fictional_example: "Exemplo fictício",
  manual: "Cadastro manual",
  recipe: "Receita caseira",
  TACO: "TACO — Unicamp",
  TBCA: "TBCA — USP",
};

export const FOOD_STATE_LABEL: Record<FoodState, string> = {
  raw: "Cru",
  cooked: "Cozido",
  not_applicable: "—",
};

export const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  not_validated: "Não validado",
  under_review: "Em revisão",
  validated: "Validado",
};

export const KETONE_QUAL_LABEL: Record<KetoneQualitative, string> = {
  negative: "Negativo",
  trace: "Traços",
  small: "Pequena (+)",
  moderate: "Moderada (++)",
  large: "Grande (+++)",
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const fmtNum = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export function relativeAge(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Local datetime-input value ("YYYY-MM-DDTHH:mm") for now */
export function nowLocalInput(d = new Date()): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
