import type {
  AuditEntry,
  ClinicalSettings,
  Food,
  GlucoseReading,
  InsulinActionProfile,
  InsulinAdministration,
  InsulinCatalogItem,
  KetoneReading,
  MealEntry,
  MealItem,
  MealType,
  MemberRole,
  Patient,
  PatientInsulin,
  PatientMember,
} from "../domain/types";
import type { IncomingReading } from "../glucose/providers";
import type { AdministrationInput, FoodInput, InsulinCatalogInput, KetoneInput } from "../validation";

export interface NewMeal {
  meal_type: MealType;
  eaten_at: string;
  notes: string | null;
  is_favorite: boolean;
  favorite_name: string | null;
  items: Omit<MealItem, "id">[];
  totals: { carbs_g: number; protein_g: number | null; fat_g: number | null; kcal: number | null; hasMissing: boolean };
}

/** Single data-access contract implemented by the in-memory demo and by Lovable Cloud. */
export interface DataStore {
  readonly mode: "demo" | "cloud";
  listPatients(): Promise<Patient[]>;
  createPatient(nickname: string): Promise<Patient>;
  updatePatient(id: string, p: { nickname: string; birth_date: string | null }): Promise<void>;

  listGlucose(pid: string, since: Date): Promise<GlucoseReading[]>;
  /** Idempotent ingest: duplicates are skipped. Returns count inserted. */
  ingestGlucose(pid: string, readings: IncomingReading[]): Promise<number>;

  listCatalog(): Promise<InsulinCatalogItem[]>;
  listActionProfiles(): Promise<InsulinActionProfile[]>;
  addCatalogInsulin(input: InsulinCatalogInput): Promise<void>;

  listPatientInsulins(pid: string): Promise<PatientInsulin[]>;
  addPatientInsulin(pid: string, p: Omit<PatientInsulin, "id" | "patient_id" | "active" | "ended_on">): Promise<void>;
  endPatientInsulin(id: string, ended_on: string): Promise<void>;

  listAdministrations(pid: string, limit?: number): Promise<InsulinAdministration[]>;
  addAdministration(pid: string, input: AdministrationInput, supersedesId?: string): Promise<void>;
  markAdministrationPerformed(id: string): Promise<void>;

  listKetones(pid: string, limit?: number): Promise<KetoneReading[]>;
  addKetone(pid: string, input: KetoneInput): Promise<void>;

  listFoods(pid: string): Promise<Food[]>;
  addFood(pid: string, input: FoodInput): Promise<void>;
  toggleFoodFavorite(id: string, fav: boolean): Promise<void>;

  listMeals(pid: string, limit?: number): Promise<MealEntry[]>;
  addMeal(pid: string, meal: NewMeal): Promise<void>;

  getSettings(pid: string): Promise<ClinicalSettings>;
  saveSettings(pid: string, s: Omit<ClinicalSettings, "patient_id">): Promise<void>;

  listMembers(pid: string): Promise<PatientMember[]>;
  inviteMember(pid: string, email: string, role: MemberRole): Promise<"ok" | "user_not_found">;
  removeMember(memberId: string): Promise<void>;

  listAudit(pid: string, limit?: number): Promise<AuditEntry[]>;
}
