import { z } from "zod";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

/** Accepts "4", "4.5" or "4,5". Rejects negative, NaN, exponent and garbage. */
export const decimalString = (opts: { min: number; max: number; label: string; maxDecimals?: number }) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${opts.label}`)
    .refine((s) => new RegExp(`^\\d{1,4}([.,]\\d{1,${opts.maxDecimals ?? 2}})?$`).test(s), {
      message: `${opts.label[0].toUpperCase()}${opts.label.slice(1)} inválido(a). Use apenas números, ex.: 4 ou 4,5`,
    })
    .transform((s) => Number(s.replace(",", ".")))
    .refine((n) => n >= opts.min && n <= opts.max, {
      message: `Valor deve estar entre ${opts.min} e ${opts.max}`,
    });

const pastOrNear = (s: string) => {
  const t = new Date(s).getTime();
  return Number.isFinite(t) && t <= Date.now() + 5 * 60000;
};

export const administrationSchema = z
  .object({
    insulin_id: z.string().min(1, "Selecione a insulina"),
    dose: decimalString({ min: 0.5, max: 300, label: "a dose", maxDecimals: 1 }),
    administered_at: z.string().min(1, "Informe data e horário").refine((s) => Number.isFinite(new Date(s).getTime()), "Data inválida"),
    purpose: z.enum(["basal", "meal", "correction", "combined"], { required_error: "Selecione o tipo" }),
    status: z.enum(["performed", "planned"]),
    confirmed: z.boolean(),
    glucose_before: z
      .string()
      .trim()
      .optional()
      .refine((s) => !s || /^\d{2,3}$/.test(s), "Glicemia inválida (use números inteiros em mg/dL)")
      .transform((s) => (s ? Number(s) : null))
      .refine((n) => n == null || (n >= 10 && n <= 1000), "Glicemia fora do intervalo aceito (10–1000)"),
    injection_site: optText(60),
    notes: optText(1000),
    recorded_by_name: optText(100),
  })
  .superRefine((v, ctx) => {
    if (v.status === "performed" && !v.confirmed) {
      ctx.addIssue({ code: "custom", path: ["confirmed"], message: "Confirme que a aplicação realmente ocorreu" });
    }
    if (v.status === "performed" && !pastOrNear(v.administered_at)) {
      ctx.addIssue({ code: "custom", path: ["administered_at"], message: "Aplicação realizada não pode estar no futuro" });
    }
  });
export type AdministrationInput = z.output<typeof administrationSchema>;

export const manualGlucoseSchema = z
  .object({
    value: decimalString({ min: 1, max: 1000, label: "o valor", maxDecimals: 1 }),
    unit: z.enum(["mg/dL", "mmol/L"]),
    measured_at: z.string().min(1, "Informe data e horário").refine(pastOrNear, "A leitura não pode estar no futuro"),
    notes: optText(500),
  })
  .superRefine((v, ctx) => {
    const ok = v.unit === "mg/dL" ? v.value >= 10 && v.value <= 1000 : v.value >= 0.6 && v.value <= 55;
    if (!ok) ctx.addIssue({ code: "custom", path: ["value"], message: "Valor incompatível com a unidade selecionada" });
  });
export type ManualGlucoseInput = z.output<typeof manualGlucoseSchema>;

export const ketoneSchema = z
  .object({
    method: z.enum(["blood", "urine"]),
    unit: z.enum(["mmol/L", "mg/dL", "qualitative"]),
    value: z.string().trim().optional(),
    qualitative: z.enum(["negative", "trace", "small", "moderate", "large"]).optional(),
    measured_at: z.string().min(1, "Informe data e horário").refine(pastOrNear, "A medição não pode estar no futuro"),
    notes: optText(500),
  })
  .transform((v, ctx) => {
    if (v.method === "blood" && v.unit !== "mmol/L") {
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Cetona no sangue é registrada em mmol/L" });
      return z.NEVER;
    }
    if (v.method === "urine" && v.unit === "mmol/L") {
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Para urina use escala qualitativa ou mg/dL" });
      return z.NEVER;
    }
    if (v.unit === "qualitative") {
      if (!v.qualitative) {
        ctx.addIssue({ code: "custom", path: ["qualitative"], message: "Selecione o resultado da fita" });
        return z.NEVER;
      }
      return { ...v, value: null as number | null, qualitative: v.qualitative };
    }
    const s = v.value ?? "";
    if (!/^\d{1,3}([.,]\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Valor inválido" });
      return z.NEVER;
    }
    const n = Number(s.replace(",", "."));
    const max = v.unit === "mmol/L" ? 15 : 200;
    if (n < 0 || n > max) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `Valor deve estar entre 0 e ${max}` });
      return z.NEVER;
    }
    return { ...v, value: n, qualitative: null };
  });
export type KetoneInput = z.output<typeof ketoneSchema>;

const optNutrient = z
  .string()
  .trim()
  .optional()
  .refine((s) => !s || /^\d{1,4}([.,]\d{1,2})?$/.test(s), "Valor inválido")
  .transform((s) => (s ? Number(s.replace(",", ".")) : null));

export const foodSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome").max(160),
    preparation: optText(80),
    state: z.enum(["raw", "cooked", "not_applicable"]),
    source: z.enum(["manual", "recipe"]),
    source_reference: optText(300),
    carbs_per_100g: optNutrient,
    protein_per_100g: optNutrient,
    fat_per_100g: optNutrient,
    kcal_per_100g: optNutrient,
    edible_portion_pct: decimalString({ min: 1, max: 100, label: "a parte comestível" }),
  })
  .superRefine((v, ctx) => {
    for (const k of ["carbs_per_100g", "protein_per_100g", "fat_per_100g"] as const) {
      const n = v[k];
      if (n != null && n > 100) ctx.addIssue({ code: "custom", path: [k], message: "Não pode passar de 100 g por 100 g" });
    }
    if (v.kcal_per_100g != null && v.kcal_per_100g > 1000)
      ctx.addIssue({ code: "custom", path: ["kcal_per_100g"], message: "Valor muito alto" });
  });
export type FoodInput = z.output<typeof foodSchema>;

export const gramsSchema = decimalString({ min: 0.1, max: 5000, label: "a quantidade", maxDecimals: 1 });

/** Schema for future validated import files (TACO/TBCA, CSV or JSON rows). */
export const foodImportRowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  preparation: z.string().trim().max(80).nullable().default(null),
  state: z.enum(["raw", "cooked", "not_applicable"]),
  source: z.enum(["TACO", "TBCA"]),
  source_reference: z.string().trim().min(1, "Referência da fonte obrigatória").max(300),
  carbs_per_100g: z.number().min(0).max(100).nullable(),
  protein_per_100g: z.number().min(0).max(100).nullable(),
  fat_per_100g: z.number().min(0).max(100).nullable(),
  kcal_per_100g: z.number().min(0).max(1000).nullable(),
  edible_portion_pct: z.number().gt(0).max(100).default(100),
});

export const settingsSchema = z
  .object({
    nickname: z.string().trim().min(1, "Informe o nome ou apelido").max(80),
    birth_date: optText(10),
    target_glucose_text: optText(100),
    very_low_mgdl: z.coerce.number().int().min(30).max(100),
    target_low_mgdl: z.coerce.number().int().min(40).max(200),
    target_high_mgdl: z.coerce.number().int().min(80).max(400),
    very_high_mgdl: z.coerce.number().int().min(150).max(500),
    sensitivity_factor_text: optText(200),
    rapid_insulin_text: optText(120),
    basal_insulin_text: optText(120),
    administration_times: optText(300),
    clinical_instructions: optText(4000),
    emergency_contact_name: optText(100),
    emergency_contact_phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .refine((s) => !s || /^[+()\d\s-]{8,30}$/.test(s), "Telefone inválido")
      .transform((v) => (v ? v : null)),
    last_review_date: optText(10),
  })
  .superRefine((v, ctx) => {
    if (!(v.very_low_mgdl < v.target_low_mgdl && v.target_low_mgdl < v.target_high_mgdl && v.target_high_mgdl < v.very_high_mgdl)) {
      ctx.addIssue({ code: "custom", path: ["target_low_mgdl"], message: "As faixas devem seguir: muito baixa < mínima < máxima < muito alta" });
    }
  });
export type SettingsInput = z.output<typeof settingsSchema>;

export const insulinCatalogSchema = z.object({
  brand_name: z.string().trim().min(1, "Informe o nome comercial").max(120),
  active_ingredient: optText(120),
  manufacturer: optText(120),
  pharmacological_class: optText(120),
  concentration: optText(30),
  route: optText(60),
  presentation: optText(120),
  onset_text: optText(300),
  peak_text: optText(300),
  effective_duration_text: optText(300),
  max_duration_text: optText(300),
  source_reference: optText(500),
  source_review_date: optText(10),
  validation_status: z.enum(["not_validated", "under_review", "validated"]),
});
export type InsulinCatalogInput = z.output<typeof insulinCatalogSchema>;

/** Duplicate warning: same insulin within window. Never blocks — only warns. */
export function findPossibleDuplicates<T extends { insulin_id: string; administered_at: string; status: string; is_superseded: boolean }>(
  existing: T[],
  candidate: { insulin_id: string; administered_at: string },
  windowMin = 30,
): T[] {
  const t = new Date(candidate.administered_at).getTime();
  return existing.filter(
    (a) =>
      !a.is_superseded &&
      a.status === "performed" &&
      a.insulin_id === candidate.insulin_id &&
      Math.abs(new Date(a.administered_at).getTime() - t) <= windowMin * 60000,
  );
}
