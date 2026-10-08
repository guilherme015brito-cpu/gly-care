// Lovable Cloud data store. Uses the browser client with the signed-in session:
// every query is filtered by Row Level Security on the server.
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SETTINGS,
  type AuditEntry,
  type CarbRatio,
  type ClinicalSettings,
  type Food,
  type GlucoseReading,
  type InsulinActionProfile,
  type InsulinAdministration,
  type InsulinCatalogItem,
  type KetoneReading,
  type MealEntry,
  type MealItem,
  type Patient,
  type PatientInsulin,
  type PatientMember,
} from "../domain/types";
import { filterNewReadings, normalize } from "../glucose/providers";
import type { DataStore } from "./store";
import type { Json } from "@/integrations/supabase/types";

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data;
}

export function friendlyError(e: { message: string; code?: string }): string {
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "Você não tem permissão para esta ação.";
  if (e.code === "23514") return "Algum valor está fora do intervalo permitido.";
  if (e.code === "23505") return "Este registro já existe.";
  if (/Failed to fetch|NetworkError/i.test(e.message)) return "Sem conexão com o servidor. Nada foi salvo.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export const cloudStore: DataStore = {
  mode: "cloud",

  async listPatients() {
    const uid = await myId();
    const rows = check(await supabase.from("patient_members").select("role, patients(id, nickname, birth_date)").eq("user_id", uid));
    return (rows ?? [])
      .filter((r) => r.patients)
      .map((r) => {
        const p = r.patients as unknown as { id: string; nickname: string; birth_date: string | null };
        return { id: p.id, nickname: p.nickname, birth_date: p.birth_date, role: r.role } satisfies Patient;
      });
  },
  async createPatient(nickname) {
    const uid = await myId();
    const id = crypto.randomUUID();
    check(await supabase.from("patients").insert({ id, nickname, created_by: uid }));
    check(await supabase.from("clinical_settings").insert({ patient_id: id }));
    return { id, nickname, birth_date: null, role: "caregiver" };
  },
  async updatePatient(id, p) {
    check(await supabase.from("patients").update(p).eq("id", id));
  },

  async listGlucose(pid, since) {
    const rows = check(
      await supabase.from("glucose_readings").select("*").eq("patient_id", pid).gte("measured_at", since.toISOString()).order("measured_at", { ascending: true }).limit(2000),
    );
    return (rows ?? []).map((r) => ({ ...r, value: Number(r.value), value_mgdl: Number(r.value_mgdl) }) as GlucoseReading);
  },
  async ingestGlucose(pid, readings) {
    if (!readings.length) return 0;
    const minT = readings.reduce((m, r) => (r.measured_at < m ? r.measured_at : m), readings[0]!.measured_at);
    const existing = check(await supabase.from("glucose_readings").select("provider_id, external_id, measured_at").eq("patient_id", pid).gte("measured_at", minT));
    const fresh = filterNewReadings(existing ?? [], readings);
    if (!fresh.length) return 0;
    const rows = fresh.map((r) => {
      const n = normalize(r, pid, crypto.randomUUID());
      return { ...n, raw_payload: (r.raw_payload ?? null) as Json };
    });
    // unique indexes make this idempotent even under races
    const res = await supabase.from("glucose_readings").upsert(rows, { onConflict: "patient_id,provider_id,measured_at", ignoreDuplicates: true });
    check(res);
    return fresh.length;
  },

  async listCatalog() {
    return check(await supabase.from("insulin_catalog").select("*").order("brand_name")) as InsulinCatalogItem[];
  },
  async listActionProfiles() {
    return check(await supabase.from("insulin_action_profiles").select("*")) as InsulinActionProfile[];
  },
  async addCatalogInsulin(i) {
    const uid = await myId();
    const id = crypto.randomUUID();
    check(await supabase.from("insulin_catalog").insert({ id, created_by: uid, brand_name: i.brand_name, active_ingredient: i.active_ingredient, manufacturer: i.manufacturer, pharmacological_class: i.pharmacological_class, concentration: i.concentration, route: i.route, presentation: i.presentation }));
    check(await supabase.from("insulin_action_profiles").insert({ insulin_id: id, created_by: uid, onset_text: i.onset_text, peak_text: i.peak_text, effective_duration_text: i.effective_duration_text, max_duration_text: i.max_duration_text, source_reference: i.source_reference, source_review_date: i.source_review_date, validation_status: i.validation_status }));
  },

  async listPatientInsulins(pid) {
    return check(await supabase.from("patient_insulins").select("*").eq("patient_id", pid).order("created_at")) as PatientInsulin[];
  },
  async addPatientInsulin(pid, p) {
    check(await supabase.from("patient_insulins").insert({ ...p, patient_id: pid }));
  },
  async endPatientInsulin(id, ended_on) {
    check(await supabase.from("patient_insulins").update({ active: false, ended_on }).eq("id", id));
  },

  async listAdministrations(pid, limit = 50) {
    const rows = check(await supabase.from("insulin_administrations").select("*").eq("patient_id", pid).order("administered_at", { ascending: false }).limit(limit));
    return (rows ?? []).map((r) => ({ ...r, dose_units: Number(r.dose_units) }) as InsulinAdministration);
  },
  async addAdministration(pid, i, supersedesId) {
    const { data: pis } = await supabase.from("patient_insulins").select("id").eq("patient_id", pid).eq("insulin_id", i.insulin_id).eq("active", true).limit(1);
    check(
      await supabase.from("insulin_administrations").insert({
        patient_id: pid,
        insulin_id: i.insulin_id,
        patient_insulin_id: pis?.[0]?.id ?? null,
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
      }),
    );
    if (supersedesId) check(await supabase.from("insulin_administrations").update({ is_superseded: true }).eq("id", supersedesId));
  },
  async markAdministrationPerformed(id) {
    check(await supabase.from("insulin_administrations").update({ status: "performed", confirmed_by_user: true }).eq("id", id));
  },

  async listKetones(pid, limit = 50) {
    const rows = check(await supabase.from("ketone_readings").select("*").eq("patient_id", pid).order("measured_at", { ascending: false }).limit(limit));
    return (rows ?? []).map((r) => ({ ...r, value: num(r.value) }) as KetoneReading);
  },
  async addKetone(pid, i) {
    check(await supabase.from("ketone_readings").insert({ patient_id: pid, method: i.method, unit: i.unit, value: i.value, qualitative: i.qualitative, measured_at: new Date(i.measured_at).toISOString(), notes: i.notes }));
  },

  async listFoods(pid) {
    const rows = check(await supabase.from("food_catalog").select("*").or(`patient_id.is.null,patient_id.eq.${pid}`).order("name").limit(1000));
    return (rows ?? []).map(
      (r) =>
        ({
          ...r,
          carbs_per_100g: num(r.carbs_per_100g),
          protein_per_100g: num(r.protein_per_100g),
          fat_per_100g: num(r.fat_per_100g),
          kcal_per_100g: num(r.kcal_per_100g),
          edible_portion_pct: Number(r.edible_portion_pct),
        }) as Food,
    );
  },
  async addFood(pid, i) {
    check(await supabase.from("food_catalog").insert({ ...i, patient_id: pid }));
  },
  async toggleFoodFavorite(id, fav) {
    check(await supabase.from("food_catalog").update({ is_favorite: fav }).eq("id", id));
  },

  async listMeals(pid, limit = 50) {
    const rows = check(await supabase.from("meal_entries").select("*, meal_items(*)").eq("patient_id", pid).order("eaten_at", { ascending: false }).limit(limit));
    return (rows ?? []).map((r) => {
      const { meal_items, ...m } = r as typeof r & { meal_items: MealItem[] };
      return {
        ...m,
        total_carbs_g: Number(m.total_carbs_g),
        total_protein_g: num(m.total_protein_g),
        total_fat_g: num(m.total_fat_g),
        total_kcal: num(m.total_kcal),
        items: (meal_items ?? []).map((it) => ({ ...it, grams: Number(it.grams), carbs_g: num(it.carbs_g), protein_g: num(it.protein_g), fat_g: num(it.fat_g), kcal: num(it.kcal) })),
      } as MealEntry;
    });
  },
  async addMeal(pid, m) {
    const id = crypto.randomUUID();
    check(
      await supabase.from("meal_entries").insert({
        id,
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
      }),
    );
    check(await supabase.from("meal_items").insert(m.items.map((it) => ({ ...it, meal_id: id, patient_id: pid }))));
  },

  async getSettings(pid) {
    const row = check(await supabase.from("clinical_settings").select("*").eq("patient_id", pid).maybeSingle());
    if (!row) return { patient_id: pid, ...DEFAULT_SETTINGS };
    return { ...row, carb_ratios: (row.carb_ratios as unknown as CarbRatio[]) ?? [] } as ClinicalSettings;
  },
  async saveSettings(pid, s) {
    check(await supabase.from("clinical_settings").upsert({ ...s, carb_ratios: s.carb_ratios as unknown as Json, patient_id: pid }));
  },

  async listMembers(pid) {
    const uid = await myId();
    const rows = check(await supabase.from("patient_members").select("id, user_id, role").eq("patient_id", pid));
    return (rows ?? []).map((r) => ({ id: r.id, user_id: r.user_id, role: r.role, display_name: r.user_id === uid ? "Você" : null, is_me: r.user_id === uid }) satisfies PatientMember);
  },
  async inviteMember(pid, email, role) {
    const res = await supabase.rpc("add_patient_member_by_email", { _patient: pid, _email: email, _role: role });
    const out = check(res);
    return out === "ok" ? "ok" : "user_not_found";
  },
  async removeMember(id) {
    check(await supabase.from("patient_members").delete().eq("id", id));
  },

  async listAudit(pid, limit = 100) {
    return check(await supabase.from("audit_logs").select("*").eq("patient_id", pid).order("changed_at", { ascending: false }).limit(limit)) as AuditEntry[];
  },
};
