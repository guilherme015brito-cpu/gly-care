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
import { tacoFoods } from "../taco-foods";
import { computeItem, sumItems } from "../nutrition";
import { REFERENCE_PRESETS } from "../insulin/config";
import { validateDosePeriods } from "../dose-periods";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
const DEMO_PID = "demo-patient";
const FICT_REF = "Valores fictícios para demonstração — não usar clinicamente";

function seedFoods(): Food[] {
  const base = (
    name: string,
    preparation: string,
    state: Food["state"],
    c: number | null,
    p: number | null,
    f: number | null,
    k: number | null,
    edible = 100,
  ): Food => ({
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
  async libre(): Promise<never> {
    throw new Error("Conexões reais não estão disponíveis na demonstração.");
  }
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
    target_glucose_text: "120",
    sensitivity_factor_text: "30",
    rapid_insulin_text: "Fiasp",
    basal_insulin_text: "Lantus · 18 UI às 07:00 e 12 UI às 22:00 (cenário fictício)",
    administration_times: "Fiasp nas refeições; Lantus às 07:00 e 22:00 (demonstração)",
    carb_ratios: [
      {
        meal_type: "breakfast",
        from: "00:00",
        to: "11:00",
        sensitivity_text: "20",
        ratio_text: "1 UI : 10 g",
      },
      {
        meal_type: "lunch",
        from: "11:00",
        to: "15:00",
        sensitivity_text: "30",
        ratio_text: "1 UI : 12 g",
      },
      {
        meal_type: "snack",
        from: "15:00",
        to: "18:00",
        sensitivity_text: "30",
        ratio_text: "1 UI : 10 g",
      },
      {
        meal_type: "dinner",
        from: "18:00",
        to: "00:00",
        sensitivity_text: "40",
        ratio_text: "1 UI : 18 g",
      },
    ],
  };
  private patient: Patient = {
    id: DEMO_PID,
    nickname: "Paciente Demonstração",
    birth_date: null,
    role: "caregiver",
  };
  private audit: AuditEntry[] = [];
  private seedPromise: Promise<void> | null = null;

  private seed() {
    return (this.seedPromise ??= this.seedData());
  }

  private async seedData() {
    const mock = new MockGlucoseProvider();
    const incoming = await mock.fetchSince(new Date(Date.now() - 7 * 86400000));
    this.glucose = incoming.map((r) => normalize(r, DEMO_PID, uid()));
    const rapid: InsulinCatalogItem = {
      id: uid(),
      brand_name: "Fiasp",
      active_ingredient: "Insulina asparte",
      manufacturer: "Novo Nordisk",
      pharmacological_class: "Análogo de ação rápida",
      concentration: "U-100",
      route: "Subcutânea",
      presentation: null,
      is_fictional: false,
    };
    const basal: InsulinCatalogItem = {
      id: uid(),
      brand_name: "Lantus",
      active_ingredient: "Insulina glargina",
      manufacturer: "Sanofi",
      pharmacological_class: "Insulina basal de ação prolongada",
      concentration: "U-100",
      route: "Subcutânea",
      presentation: null,
      is_fictional: false,
    };
    this.catalog = [rapid, basal];
    this.profiles = [rapid, basal].map((i, index) => {
      const p = index === 0 ? REFERENCE_PRESETS.fiasp : REFERENCE_PRESETS.lantus;
      return {
        id: uid(),
        insulin_id: i.id,
        ...p,
        source_review_date: "2026-10-11",
        validation_status: "under_review" as const,
      };
    });
    const piR: PatientInsulin = {
      id: uid(),
      patient_id: DEMO_PID,
      insulin_id: rapid.id,
      role: "rapid",
      prescribed_dose_text: "Calculadora da refeição (demonstração)",
      prescribed_times: "Refeições",
      notes: null,
      active: true,
      started_on: null,
      ended_on: null,
    };
    const piB: PatientInsulin = {
      id: uid(),
      patient_id: DEMO_PID,
      insulin_id: basal.id,
      role: "basal",
      prescribed_dose_text: "18 UI às 07:00 e 12 UI às 22:00",
      prescribed_times: "07:00, 22:00",
      notes:
        "Esquema fictício solicitado para demonstração; não é recomendação de esquema terapêutico.",
      active: true,
      started_on: null,
      ended_on: null,
    };
    this.patientInsulins = [piR, piB];
    const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const mk = (
      ins: InsulinCatalogItem,
      dose: number,
      at: string,
      purpose: InsulinAdministration["purpose"],
    ): InsulinAdministration => ({
      id: uid(),
      patient_id: DEMO_PID,
      insulin_id: ins.id,
      patient_insulin_id: null,
      dose_units: dose,
      administered_at: at,
      purpose,
      status: "performed",
      confirmed_by_user: true,
      glucose_before_mgdl: null,
      injection_site: null,
      notes: "Registro simulado",
      recorded_by_name: "Demonstração",
      supersedes_id: null,
      is_superseded: false,
      created_at: at,
    });
    const basalSchedule: InsulinAdministration[] = [];
    for (const daysAgo of [1, 0]) {
      for (const [hour, dose] of [
        [7, 18],
        [22, 12],
      ] as const) {
        const at = new Date();
        at.setDate(at.getDate() - daysAgo);
        at.setHours(hour, 0, 0, 0);
        if (at.getTime() <= Date.now())
          basalSchedule.push(mk(basal, dose, at.toISOString(), "basal"));
      }
    }
    this.admins = [mk(rapid, 3, h(2.5), "meal"), ...basalSchedule, mk(rapid, 2.5, h(7), "meal")];
    this.ketones = [
      {
        id: uid(),
        patient_id: DEMO_PID,
        method: "blood",
        value: 0.2,
        unit: "mmol/L",
        qualitative: null,
        measured_at: h(5),
        notes: "Registro simulado",
      },
    ];
    const mealItems = [
      ["Arroz, tipo 1, cozido", 100],
      ["Feijão, carioca, cozido", 80],
      ["Frango, peito, sem pele, cozido", 90],
    ] as const;
    const items = mealItems.map(([name, grams]) => ({
      id: uid(),
      ...computeItem(
        tacoFoods.find((food) => food.name === name)!,
        grams,
      ),
    }));
    const totals = sumItems(items);
    this.meals = [
      {
        id: uid(),
        patient_id: DEMO_PID,
        meal_type: "lunch",
        eaten_at: h(2.6),
        total_carbs_g: totals.carbs_g!,
        total_protein_g: totals.protein_g,
        total_fat_g: totals.fat_g,
        total_kcal: totals.kcal,
        has_missing_values: totals.hasMissing,
        notes: "Refeição simulada com composição TACO",
        is_favorite: false,
        favorite_name: null,
        items,
      },
    ];
  }

  private log(
    table: string,
    record_id: string,
    action: string,
    old_data: unknown,
    new_data: unknown,
  ) {
    this.audit.unshift({
      id: this.audit.length + 1,
      table_name: table,
      record_id,
      action,
      changed_at: new Date().toISOString(),
      old_data: old_data as AuditEntry["old_data"],
      new_data: new_data as AuditEntry["new_data"],
    });
  }

  async listPatients() {
    await this.seed();
    return [this.patient];
  }
  async createPatient(nickname: string) {
    this.patient = { ...this.patient, nickname };
    return this.patient;
  }
  async updatePatient(_id: string, p: { nickname: string; birth_date: string | null }) {
    this.patient = { ...this.patient, ...p };
  }

  async listGlucose(_pid: string, since: Date) {
    await this.seed();
    return this.glucose
      .filter((g) => new Date(g.measured_at) >= since)
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  }
  async ingestGlucose(pid: string, readings: Parameters<DataStore["ingestGlucose"]>[1]) {
    if (readings.some((r) => r.source === "external"))
      throw new Error("Leituras externas não podem entrar na demonstração.");
    await this.seed();
    const fresh = filterNewReadings(this.glucose, readings);
    for (const r of fresh) {
      const g = normalize(r, pid, uid());
      this.glucose.push(g);
      this.log("glucose_readings", g.id, "INSERT", null, g);
    }
    return fresh.length;
  }

  async listCatalog() {
    await this.seed();
    return this.catalog;
  }
  async listActionProfiles() {
    await this.seed();
    return this.profiles;
  }
  async addCatalogInsulin(i: Parameters<DataStore["addCatalogInsulin"]>[0]) {
    const item: InsulinCatalogItem = {
      id: uid(),
      brand_name: i.brand_name,
      active_ingredient: i.active_ingredient,
      manufacturer: i.manufacturer,
      pharmacological_class: i.pharmacological_class,
      concentration: i.concentration,
      route: i.route,
      presentation: i.presentation,
    };
    this.catalog.push(item);
    this.profiles.push({
      id: uid(),
      insulin_id: item.id,
      onset_text: i.onset_text,
      peak_text: i.peak_text,
      effective_duration_text: i.effective_duration_text,
      max_duration_text: i.max_duration_text,
      source_reference: i.source_reference,
      source_review_date: i.source_review_date,
      validation_status: i.validation_status,
      visual_profile: i.visual_profile ?? null,
    });
  }

  async listPatientInsulins() {
    await this.seed();
    return this.patientInsulins;
  }
  async saveActionProfile(insulinId: string, i: Parameters<DataStore["addCatalogInsulin"]>[0]) {
    const p = this.profiles.find((p) => p.insulin_id === insulinId);
    if (!p) throw new Error("Perfil nao encontrado.");
    Object.assign(p, {
      onset_text: i.onset_text,
      peak_text: i.peak_text,
      effective_duration_text: i.effective_duration_text,
      max_duration_text: i.max_duration_text,
      source_reference: i.source_reference,
      source_review_date: i.source_review_date,
      validation_status: i.validation_status,
      visual_profile: i.visual_profile ?? null,
    });
  }
  async confirmScheduledBasal(id: string, time: string, at: string) {
    const p = this.patientInsulins.find((p) => p.id === id && p.active && p.role === "basal");
    const slot = p?.daily_schedule?.find((s) => s.time === time);
    if (!p || !slot) throw new Error("Horario nao encontrado.");
    const day = new Date(at).toLocaleDateString("en-CA", { timeZone: p.schedule_timezone });
    const tag = `schedule:${id}:${day}:${time}`;
    if (this.admins.some((a) => a.notes === tag)) return;
    this.insertAdministration(p.patient_id, {
      insulin_id: p.insulin_id,
      dose: slot.dose,
      administered_at: at,
      purpose: "basal",
      status: "performed",
      confirmed: true,
      glucose_before: null,
      injection_site: null,
      notes: tag,
      recorded_by_name: null,
    });
  }
  async addPatientInsulin(pid: string, p: Parameters<DataStore["addPatientInsulin"]>[1]) {
    const row = { ...p, id: uid(), patient_id: pid, active: true, ended_on: null };
    this.patientInsulins.push(row);
    this.log("patient_insulins", row.id, "INSERT", null, row);
  }
  async endPatientInsulin(id: string, ended_on: string) {
    const r = this.patientInsulins.find((x) => x.id === id);
    if (r) {
      const old = { ...r };
      r.active = false;
      r.ended_on = ended_on;
      this.log("patient_insulins", id, "UPDATE", old, r);
    }
  }

  async listAdministrations(_pid: string, limit = 50) {
    await this.seed();
    return [...this.admins]
      .sort((a, b) => b.administered_at.localeCompare(a.administered_at))
      .slice(0, limit);
  }
  async addAdministration(
    pid: string,
    i: Parameters<DataStore["addAdministration"]>[1],
    supersedesId?: string,
  ) {
    this.insertAdministration(pid, i, supersedesId);
  }

  private insertAdministration(
    pid: string,
    i: Parameters<DataStore["addAdministration"]>[1],
    supersedesId?: string,
  ) {
    const row = this.administrationRow(pid, i, supersedesId);
    if (supersedesId) {
      const old = this.admins.find((a) => a.id === supersedesId);
      if (old) {
        const prev = { ...old };
        old.is_superseded = true;
        this.log("insulin_administrations", old.id, "UPDATE", prev, old);
      }
    }
    this.admins.push(row);
    this.log("insulin_administrations", row.id, "INSERT", null, row);
  }

  private administrationRow(
    pid: string,
    i: Parameters<DataStore["addAdministration"]>[1],
    supersedesId?: string,
    mealId?: string,
  ): InsulinAdministration {
    const ins = this.patientInsulins.find((p) => p.insulin_id === i.insulin_id && p.active);
    const row: InsulinAdministration = {
      id: uid(),
      patient_id: pid,
      insulin_id: i.insulin_id,
      patient_insulin_id: ins?.id ?? null,
      dose_units: i.dose,
      administered_at: new Date(i.administered_at).toISOString(),
      purpose: i.purpose,
      status: i.status,
      confirmed_by_user: i.status === "performed" && i.confirmed,
      glucose_before_mgdl: i.glucose_before,
      injection_site: i.injection_site,
      notes: i.notes,
      recorded_by_name: i.recorded_by_name,
      supersedes_id: supersedesId ?? null,
      is_superseded: false,
      created_at: new Date().toISOString(),
      ...(mealId ? { meal_id: mealId } : {}),
    };
    return row;
  }
  async markAdministrationPerformed(id: string, administeredAt = new Date().toISOString()) {
    const a = this.admins.find((x) => x.id === id);
    if (!a || a.is_superseded) throw new Error("Registro não disponível para confirmação.");
    if (a.status === "performed") return;
    const at = new Date(administeredAt).getTime();
    if (!Number.isFinite(at) || at > Date.now() + 5 * 60000)
      throw new Error("Informe um horário efetivo válido, não futuro.");
    const prev = { ...a };
    a.status = "performed";
    a.confirmed_by_user = true;
    a.administered_at = new Date(at).toISOString();
    this.log("insulin_administrations", id, "UPDATE", prev, a);
  }

  async listKetones(_pid: string, limit = 50) {
    await this.seed();
    return [...this.ketones]
      .sort((a, b) => b.measured_at.localeCompare(a.measured_at))
      .slice(0, limit);
  }
  async addKetone(pid: string, i: Parameters<DataStore["addKetone"]>[1]) {
    const row: KetoneReading = {
      id: uid(),
      patient_id: pid,
      method: i.method,
      value: i.value,
      unit: i.unit,
      qualitative: i.qualitative,
      measured_at: new Date(i.measured_at).toISOString(),
      notes: i.notes,
    };
    this.ketones.push(row);
    this.log("ketone_readings", row.id, "INSERT", null, row);
  }

  async listFoods() {
    return this.foods;
  }
  async addFood(pid: string, i: Parameters<DataStore["addFood"]>[1]) {
    this.foods.push({
      id: uid(),
      patient_id: pid,
      name: i.name,
      preparation: i.preparation,
      state: i.state,
      source: i.source,
      source_reference: i.source_reference,
      carbs_per_100g: i.carbs_per_100g,
      protein_per_100g: i.protein_per_100g,
      fat_per_100g: i.fat_per_100g,
      kcal_per_100g: i.kcal_per_100g,
      edible_portion_pct: i.edible_portion_pct,
      is_favorite: false,
    });
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
    this.insertMeal(pid, m);
  }

  private insertMeal(pid: string, m: Parameters<DataStore["addMeal"]>[1]) {
    const row = this.mealRow(pid, m);
    this.meals.push(row);
    this.log("meal_entries", row.id, "INSERT", null, row);
  }

  private mealRow(pid: string, m: Parameters<DataStore["addMeal"]>[1]): MealEntry {
    const row: MealEntry = {
      id: uid(),
      patient_id: pid,
      meal_type: m.meal_type,
      eaten_at: new Date(m.eaten_at).toISOString(),
      total_carbs_g: m.totals.carbs_g,
      total_protein_g: m.totals.protein_g,
      total_fat_g: m.totals.fat_g,
      total_kcal: m.totals.kcal,
      has_missing_values: m.totals.hasMissing,
      notes: m.notes,
      is_favorite: m.is_favorite,
      favorite_name: m.favorite_name,
      items: m.items.map((it) => ({ ...it, id: uid() })),
    };
    return row;
  }

  async addMealWithAdministration(
    pid: string,
    meal: Parameters<DataStore["addMeal"]>[1],
    administration: Parameters<DataStore["addAdministration"]>[1],
  ) {
    await this.seed();
    const rapid = this.patientInsulins.find(
      (p) => p.active && p.role === "rapid" && p.insulin_id === administration.insulin_id,
    );
    const at = new Date(administration.administered_at).getTime();
    if (
      pid !== this.patient.id ||
      !rapid ||
      !Number.isFinite(administration.dose) ||
      administration.dose <= 0 ||
      !Number.isFinite(at) ||
      !Number.isFinite(new Date(meal.eaten_at).getTime()) ||
      !meal.items.length ||
      meal.items.some(
        (i) =>
          i.carbs_g == null ||
          !Number.isFinite(i.carbs_g) ||
          i.carbs_g < 0 ||
          !Number.isFinite(i.grams) ||
          i.grams <= 0,
      ) ||
      !Number.isFinite(meal.totals.carbs_g) ||
      meal.totals.carbs_g < 0 ||
      (administration.glucose_before != null &&
        (!Number.isFinite(administration.glucose_before) || administration.glucose_before < 0)) ||
      (administration.status === "performed" &&
        (!administration.confirmed || at > Date.now() + 5 * 60000))
    ) {
      throw new Error(
        "Revise a refeição, a insulina rápida, a dose e o horário. Nada foi registrado.",
      );
    }
    // Prepare both complete records before committing either collection or its audit entry.
    const preparedMeal = { ...meal, eaten_at: new Date(meal.eaten_at).toISOString() };
    const preparedAdministration = {
      ...administration,
      administered_at: new Date(at).toISOString(),
    };
    const row = this.mealRow(pid, preparedMeal);
    const admin = this.administrationRow(pid, preparedAdministration, undefined, row.id);
    this.meals.push(row);
    this.admins.push(admin);
    this.log("meal_entries", row.id, "INSERT", null, row);
    this.log("insulin_administrations", admin.id, "INSERT", null, admin);
  }

  async getSettings() {
    return this.settings;
  }
  async saveSettings(pid: string, s: Parameters<DataStore["saveSettings"]>[1]) {
    const error = validateDosePeriods(s.carb_ratios);
    if (error) throw new Error(error);
    const old = this.settings;
    this.settings = { ...s, patient_id: pid };
    this.log("clinical_settings", pid, "UPDATE", old, this.settings);
  }

  async listMembers(): Promise<PatientMember[]> {
    return [
      {
        id: "m1",
        user_id: "demo",
        role: "caregiver",
        display_name: "Você (demonstração)",
        is_me: true,
      },
    ];
  }
  async inviteMember(): Promise<"ok" | "user_not_found"> {
    throw new Error("Convites não estão disponíveis no modo demonstração.");
  }
  async removeMember() {
    throw new Error("Não disponível no modo demonstração.");
  }
  async listAudit(_pid: string, limit = 100) {
    return this.audit.slice(0, limit);
  }
}

let instance: DemoStore | null = null;
export function getDemoStore(): DataStore {
  if (!instance) instance = new DemoStore();
  return instance;
}
export function resetDemoStore() {
  instance = null;
}
