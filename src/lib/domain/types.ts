// Domain types shared by the demo store and the Cloud store.
// Keep in sync with the SQL migration (enums and column names).

export type MemberRole = "caregiver" | "patient" | "professional_readonly";
export type GlucoseSource = "simulation" | "manual" | "external";
export type GlucoseTrend = "rising_fast" | "rising" | "stable" | "falling" | "falling_fast" | "unknown";
export type GlucoseUnit = "mg/dL" | "mmol/L";
export type ReadingQuality = "valid" | "questionable" | "invalid";
export type AdministrationStatus = "performed" | "planned";
export type AdministrationPurpose = "basal" | "meal" | "correction" | "combined";
export type KetoneMethod = "blood" | "urine";
export type KetoneQualitative = "negative" | "trace" | "small" | "moderate" | "large";
export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "supper" | "other";
export type ValidationStatus = "not_validated" | "under_review" | "validated";
export type FoodSource = "fictional_example" | "manual" | "recipe" | "TACO" | "TBCA";
export type FoodState = "raw" | "cooked" | "not_applicable";

export interface Patient {
  id: string;
  nickname: string;
  birth_date: string | null;
  role: MemberRole;
}

export interface GlucoseReading {
  id: string;
  patient_id: string;
  value: number;
  unit: GlucoseUnit;
  value_mgdl: number;
  measured_at: string;
  received_at: string;
  source: GlucoseSource;
  provider_id: string;
  external_id: string | null;
  trend: GlucoseTrend;
  quality: ReadingQuality;
  notes: string | null;
}

export interface InsulinCatalogItem {
  id: string;
  brand_name: string;
  active_ingredient: string | null;
  manufacturer: string | null;
  pharmacological_class: string | null;
  concentration: string | null;
  route: string | null;
  presentation: string | null;
  is_fictional?: boolean;
}

export interface InsulinActionProfile {
  id: string;
  insulin_id: string;
  onset_text: string | null;
  peak_text: string | null;
  effective_duration_text: string | null;
  max_duration_text: string | null;
  source_reference: string | null;
  source_review_date: string | null;
  validation_status: ValidationStatus;
}

export interface PatientInsulin {
  id: string;
  patient_id: string;
  insulin_id: string;
  role: "rapid" | "basal" | "other";
  prescribed_dose_text: string | null;
  prescribed_times: string | null;
  notes: string | null;
  active: boolean;
  started_on: string | null;
  ended_on: string | null;
}

export interface InsulinAdministration {
  id: string;
  patient_id: string;
  insulin_id: string;
  patient_insulin_id: string | null;
  dose_units: number;
  administered_at: string;
  purpose: AdministrationPurpose;
  status: AdministrationStatus;
  confirmed_by_user: boolean;
  glucose_before_mgdl: number | null;
  injection_site: string | null;
  notes: string | null;
  recorded_by_name: string | null;
  supersedes_id: string | null;
  is_superseded: boolean;
  created_at: string;
}

export interface KetoneReading {
  id: string;
  patient_id: string;
  method: KetoneMethod;
  value: number | null;
  unit: "mmol/L" | "mg/dL" | "qualitative";
  qualitative: KetoneQualitative | null;
  measured_at: string;
  notes: string | null;
}

export interface Food {
  id: string;
  patient_id: string | null;
  name: string;
  preparation: string | null;
  state: FoodState;
  source: FoodSource;
  source_reference: string | null;
  carbs_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  kcal_per_100g: number | null;
  edible_portion_pct: number;
  is_favorite: boolean;
}

export interface MealItem {
  id: string;
  food_id: string | null;
  food_name: string;
  food_source: FoodSource;
  grams: number;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  kcal: number | null;
}

export interface MealEntry {
  id: string;
  patient_id: string;
  meal_type: MealType;
  eaten_at: string;
  total_carbs_g: number;
  total_protein_g: number | null;
  total_fat_g: number | null;
  total_kcal: number | null;
  has_missing_values: boolean;
  notes: string | null;
  is_favorite: boolean;
  favorite_name: string | null;
  items: MealItem[];
}

export interface CarbRatio {
  from: string; // "HH:MM"
  to: string;
  ratio_text: string;
}

export interface ClinicalSettings {
  patient_id: string;
  target_glucose_text: string | null;
  target_low_mgdl: number;
  target_high_mgdl: number;
  very_low_mgdl: number;
  very_high_mgdl: number;
  sensitivity_factor_text: string | null;
  carb_ratios: CarbRatio[];
  rapid_insulin_text: string | null;
  basal_insulin_text: string | null;
  administration_times: string | null;
  clinical_instructions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  last_review_date: string | null;
}

export interface PatientMember {
  id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
  is_me: boolean;
}

export interface AuditEntry {
  id: number;
  table_name: string;
  record_id: string;
  action: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export const DEFAULT_SETTINGS: Omit<ClinicalSettings, "patient_id"> = {
  target_glucose_text: null,
  target_low_mgdl: 70,
  target_high_mgdl: 180,
  very_low_mgdl: 54,
  very_high_mgdl: 250,
  sensitivity_factor_text: null,
  carb_ratios: [],
  rapid_insulin_text: null,
  basal_insulin_text: null,
  administration_times: null,
  clinical_instructions: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  last_review_date: null,
};
