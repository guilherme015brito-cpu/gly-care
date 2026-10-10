// In-memory demo store. Data is SIMULATED and lives only in this browser tab.
// Nothing here is persisted (no localStorage / IndexedDB) by design.
import {
  DEFAULT_SETTINGS,
  type AuditEntry,
  type ClinicalSettings,
  type Food,
  type GlucoseReading,
  type InsulinActionProfile,
  type InsulinAdministration,
  type InsulinCatalogItem,
  type KetoneReading,
  type MealEntry,
  type Patient,
  type PatientInsulin,
  type PatientMember,
} from "../domain/types";
import { MockGlucoseProvider, filterNewReadings, normalize } from "../glucose/providers";
import type { DataStore } from "./store";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));
const DEMO_PID = "demo-patient";
const FICT_REF = "Valores fictícios para demonstração — não usar clinicamente";

function seedFoods(): Food[] {
  const base = (name: string, preparation: string, state: Food["state"], c: number | null, p: number | null, f: number | null, k: number | null, edible = 100): Food => ({
    id: uid(),
    patient_id: null,
    name,
    preparation,
    state,
    source: "fictional_example",
    source_reference: FICT_REF,
    carbs_per_100g: c,
    protein_per_100g: p,
    fat_per_100g: f,
    kcal_per_100g: k,
    edible_portion_pct: edible,
    is_favorite: false,
  });
  return [
    base("Arroz exemplo (FICTÍCIO)", "cozido", "cooked", 30, 2.5, 0.3, 135),
    base("Feijão exemplo (FICTÍCIO)", "cozido", "cooked", 14, 5, 0.5, 80),
    base("Pão exemplo (FICTÍCIO)", "assado", "not_applicable", 55, 8, 3, 290),
    base("Banana exemplo (FICTÍCIO)", "in natura", "raw", 22, 1.2, 0.2, 95, 65),
    base("Leite exemplo (FICTÍCIO)", "líquido", "not_applicable", 5, 3.2, null, null),
  ];
}

class DemoStore implements DataStore {
  readonly mode = "demo" as const;
  private glucose: GlucoseReading[] = [];
  private catalog: InsulinCatalogItem[] = [];
  private profiles: InsulinActionProfile[] = [];
  private patientInsulins: PatientInsulin[] = [];
  private admins: InsulinAdministration[] = [];
  private ketones: KetoneReading[] = [];
  private foods: Food[] = seedFoods();
  private meals: MealEntry[] = [];
  private settings: ClinicalSettings = {
    patient_id: DEMO_PID,
    ...DEFAULT_SETTINGS,
    target_glucose_text: "110 mg/dL (FICTÍCIO)",
    sensitivity_factor_text: "Valores inventados exclusivamente para testar o formulário",
    carb_ratios: [
      { from: "", to: "", meal_type: "breakfast", ratio_text: "1 : 15", carbs_g_per_unit: 15, sensitivity_mgdl_per_unit: 45 },
      { from: "", to: "", meal_type: "lunch", ratio_text: "1 : 14", carbs_g_per_unit: 14, sensitivity_mgdl_per_unit: 50 },
      { from: "", to: "", meal_type: "snack", ratio_text: "1 : 16", carbs_g_per_unit: 16, sensitivity_mgdl_per_unit: 55 },
      { from: "", to: "", meal_type: "dinner", ratio_text: "1 : 20", carbs_g_per_unit: 20, sensitivity_mgdl_per_unit: 60 },
    ],
    rapid_insulin_text: "Insulina rápida EXEMPLO (FICTÍCIA)",
    basal_insulin_text: "Insulina basal EXEMPLO (FICTÍCIA)",
    administration_times: "22:00 — exemplo não clínico",
    clinical_instructions: "DADOS SIMULADOS. Não utilizar os valores para decisões médicas.",
  };
  private patient: Patient = { id: DEMO_PID, nickname: "Paciente Demonstração", birth_date: null, role: "caregiver" };
  private audit: AuditEntry[] = [];
  private seeded = false;

  private async seed() {
    if (this.seeded) return;
    this.seeded = true;
    const mock = new MockGlucoseProvider();
    const incoming = await mock.fetchSince(new Date(Date.now() - 7 * 86400000));
    this.glucose = incoming.map((r) => normalize(r, DEMO_PID, uid()));
    const rapid: InsulinCatalogItem = { id: uid(), brand_name: "Insulina rápida EXEMPLO (fictícia)", active_ingredient: null, manufacturer: null, pharmacological_class: "Análogo de ação rápida (exemplo)", concentration: "U-100", route: "Subcutânea", presentation: null, is_fictional: true };
    const basal: InsulinCatalogItem = { id: uid(), brand_name: "Insulina basal EXEMPLO (fictícia)", active_ingredient: null, manufacturer: null, pharmacological_class: "Análogo de ação longa (exemplo)", concentration: "U-100", route: "Subcutânea", presentation: null, is_fictional: true };
    this.catalog = [rapid, basal];
    this.profiles = [rapid, basal].map((i) => ({ id: uid(), insulin_id: i.id, onset_text: null, peak_text: null, effective_duration_text: null, max_duration_text: null, source_reference: null, source_review_date: null, validation_status: "not_validated" }));
    const piR: PatientInsulin = { id: uid(), patient_id: DEMO_PID, insulin_id: rapid.id, role: "rapid", prescribed_dose_text: "Conforme prescrição (exemplo)", prescribed_times: "Refeições", notes: null, active: true, started_on: null, ended_on: null };
    const piB: PatientInsulin = { id: uid(), patient_id: DEMO_PID, insulin_id: basal.id, role: "basal", prescribed_dose_text: "Conforme prescrição (exemplo)", prescribed_times: "22:00", notes: null, active: true, started_on: null, ended_on: null };
    this.patientInsulins = [piR, piB];
    const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const mk = (ins: InsulinCatalogItem, dose: number, at: string, purpose: InsulinAdministration["purpose"]): InsulinAdministration => ({ id: uid(), patient_id: DEMO_PID, insulin_id: ins.id, patient_insulin_id: null, dose_units: dose, administered_at: at, purpose, status: "performed", confirmed_by_user: true, glucose_before_mgdl: null, injection_site: null, notes: "Registro simulado", recorded_by_name: "Demonstração", supersedes_id: null, is_superseded: false, created_at: at });
    this.admins = [mk(rapid, 3, h(2.5), "meal"), mk(basal, 10, h(14), "basal"), mk(rapid, 2.5, h(7), "meal")];
    this.ketones = [{ id: uid(), patient_id: DEMO_PID, method: "blood", value: 0.2, unit: "mmol/L", qualitative: null, measured_at: h(5), notes: "Registro simulado" }];
    const f = this.foods;
    this.meals = [
      { id: uid(), patient_id: DEMO_PID, meal_type: "lunch", eaten_at: h(2.6), total_carbs_g: 44, total_protein_g: 12.5, total_fat_g: 1.3, total_kcal: 455, has_missing_values: false, notes: "Refeição simulada", is_favorite: false, favorite_name: null,
        items: [
          { id: uid(), food_id: f[0]!.id, food_name: f[0]!.name, food_source: "fictional_example", grams: 100, carbs_g: 30, protein_g: 2.5, fat_g: 0.3, kcal: 135 },
          { id: uid(), food_id: f[1]!.id, food_name: f[1]!.name, food_source: "fictional_example", grams: 100, carbs_g: 14, protein_g: 5, fat_g: 0.5, kcal: 80 },
        ] },
    ];
  }

  private log(table: string, record_id: string, action: string, old_data: unknown, new_data: unknown) {
    this.audit.unshift({ id: this.audit.length + 1, table_name: table, record_id, action, changed_at: new Date().toISOString(), old_data: old_data as AuditEntry["old_data"], new_data: new_data as AuditEntry["new_data"] });
  }

  async listPatients() { await this.seed(); return [this.patient]; }
  async createPatient(nickname: string) { this.patient = { ...this.patient, nickname }; return this.patient; }
  async updatePatient(_id: string, p: { nickname: string; birth_date: string | null }) { this.patient = { ...this.patient, ...p }; }

  async listGlucose(_pid: string, since: Date) {
    await this.seed();
    return this.glucose.filter((g) => new Date(g.measured_at) >= since).sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  }
  async ingestGlucose(pid: string, readings: Parameters<DataStore["ingestGlucose"]>[1]) {
    await this.seed();
    const fresh = filterNewReadings(this.glucose, readings);
    for (const r of fresh) {
      const g = normalize(r, pid, uid());
      this.glucose.push(g);
      this.log("glucose_readings", g.id, "INSERT", null, g);
    }
    return fresh.length;
  }

  async listCatalog() { await this.seed(); return this.catalog; }
  async listActionProfiles() { await this.seed(); return this.profiles; }
  async addCatalogInsulin(i: Parameters<DataStore["addCatalogInsulin"]>[0]) {
    const item: InsulinCatalogItem = { id: uid(), brand_name: i.brand_name, active_ingredient: i.active_ingredient, manufacturer: i.manufacturer, pharmacological_class: i.pharmacological_class, concentration: i.concentration, route: i.route, presentation: i.presentation };
    this.catalog.push(item);
    this.profiles.push({ id: uid(), insulin_id: item.id, onset_text: i.onset_text, peak_text: i.peak_text, effective_duration_text: i.effective_duration_text, max_duration_text: i.max_duration_text, source_reference: i.source_reference, source_review_date: i.source_review_date, validation_status: i.validation_status });
  }

  async listPatientInsulins() { await this.seed(); return this.patientInsulins; }
  async addPatientInsulin(pid: string, p: Parameters<DataStore["addPatientInsulin"]>[1]) {
    const row = { ...p, id: uid(), patient_id: pid, active: true, ended_on: null };
    this.patientInsulins.push(row);
    this.log("patient_insulins", row.id, "INSERT", null, row);
  }
  async endPatientInsulin(id: string, ended_on: string) {
    const r = this.patientInsulins.find((x) => x.id === id);
    if (r) { const old = { ...r }; r.active = false; r.ended_on = ended_on; this.log("patient_insulins", id, "UPDATE", old, r); }
  }

  async listAdministrations(_pid: string, limit = 50) {
    await this.seed();
    return [...this.admins].sort((a, b) => b.administered_at.localeCompare(a.administered_at)).slice(0, limit);
  }
  async addAdministration(pid: string, i: Parameters<DataStore["addAdministration"]>[1], supersedesId?: string) {
    const ins = this.patientInsulins.find((p) => p.insulin_id === i.insulin_id && p.active);
    const row: InsulinAdministration = { id: uid(), patient_id: pid, insulin_id: i.insulin_id, patient_insulin_id: ins?.id ?? null, dose_units: i.dose, administered_at: new Date(i.administered_at).toISOString(), purpose: i.purpose, status: i.status, confirmed_by_user: i.status === "performed" && i.confirmed, glucose_before_mgdl: i.glucose_before, injection_site: i.injection_site, notes: i.notes, recorded_by_name: i.recorded_by_name, supersedes_id: supersedesId ?? null, is_superseded: false, created_at: new Date().toISOString() };
    if (supersedesId) {
      const old = this.admins.find((a) => a.id === supersedesId);
      if (old) { const prev = { ...old }; old.is_superseded = true; this.log("insulin_administrations", old.id, "UPDATE", prev, old); }
    }
    this.admins.push(row);
    this.log("insulin_administrations", row.id, "INSERT", null, row);
  }
  async markAdministrationPerformed(id: string) {
    const a = this.admins.find((x) => x.id === id);
    if (a) { const prev = { ...a }; a.status = "performed"; a.confirmed_by_user = true; this.log("insulin_administrations", id, "UPDATE", prev, a); }
  }

  async listKetones(_pid: string, limit = 50) {
    await this.seed();
    return [...this.ketones].sort((a, b) => b.measured_at.localeCompare(a.measured_at)).slice(0, limit);
  }
  async addKetone(pid: string, i: Parameters<DataStore["addKetone"]>[1]) {
    const row: KetoneReading = { id: uid(), patient_id: pid, method: i.method, value: i.value, unit: i.unit, qualitative: i.qualitative, measured_at: new Date(i.measured_at).toISOString(), notes: i.notes };
    this.ketones.push(row);
    this.log("ketone_readings", row.id, "INSERT", null, row);
  }

  async listFoods() { return this.foods; }
  async addFood(pid: string, i: Parameters<DataStore["addFood"]>[1]) {
    this.foods.push({ id: uid(), patient_id: pid, name: i.name, preparation: i.preparation, state: i.state, source: i.source, source_reference: i.source_reference, carbs_per_100g: i.carbs_per_100g, protein_per_100g: i.protein_per_100g, fat_per_100g: i.fat_per_100g, kcal_per_100g: i.kcal_per_100g, edible_portion_pct: i.edible_portion_pct, is_favorite: false });
  }
  async toggleFoodFavorite(id: string, fav: boolean) {
    const f = this.foods.find((x) => x.id === id);
    if (f) f.is_favorite = fav;
  }

  async listMeals(_pid: string, limit = 50) {
    await this.seed();
    return [...this.meals].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at)).slice(0, limit);
  }
  async addMeal(pid: string, m: Parameters<DataStore["addMeal"]>[1]) {
    const row: MealEntry = { id: uid(), patient_id: pid, meal_type: m.meal_type, eaten_at: new Date(m.eaten_at).toISOString(), total_carbs_g: m.totals.carbs_g, total_protein_g: m.totals.protein_g, total_fat_g: m.totals.fat_g, total_kcal: m.totals.kcal, has_missing_values: m.totals.hasMissing, notes: m.notes, is_favorite: m.is_favorite, favorite_name: m.favorite_name, items: m.items.map((it) => ({ ...it, id: uid() })) };
    this.meals.push(row);
    this.log("meal_entries", row.id, "INSERT", null, row);
  }

  async getSettings() { return this.settings; }
  async saveSettings(pid: string, s: Parameters<DataStore["saveSettings"]>[1]) {
    const old = this.settings;
    this.settings = { ...s, patient_id: pid };
    this.log("clinical_settings", pid, "UPDATE", old, this.settings);
  }

  async listMembers(): Promise<PatientMember[]> {
    return [{ id: "m1", user_id: "demo", role: "caregiver", display_name: "Você (demonstração)", is_me: true }];
  }
  async inviteMember(): Promise<"ok" | "user_not_found"> {
    throw new Error("Convites não estão disponíveis no modo demonstração.");
  }
  async removeMember() {
    throw new Error("Não disponível no modo demonstração.");
  }
  async listAudit(_pid: string, limit = 100) { return this.audit.slice(0, limit); }
}

let instance: DemoStore | null = null;
export function getDemoStore(): DataStore {
  if (!instance) instance = new DemoStore();
  return instance;
}
export function resetDemoStore() {
  instance = null;
}
