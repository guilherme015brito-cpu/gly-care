export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          patient_id: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          patient_id?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          patient_id?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      clinical_settings: {
        Row: {
          administration_times: string | null
          basal_insulin_text: string | null
          carb_ratios: Json
          clinical_instructions: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          last_review_date: string | null
          patient_id: string
          rapid_insulin_text: string | null
          sensitivity_factor_text: string | null
          target_glucose_text: string | null
          target_high_mgdl: number
          target_low_mgdl: number
          updated_at: string
          updated_by: string | null
          very_high_mgdl: number
          very_low_mgdl: number
        }
        Insert: {
          administration_times?: string | null
          basal_insulin_text?: string | null
          carb_ratios?: Json
          clinical_instructions?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          last_review_date?: string | null
          patient_id: string
          rapid_insulin_text?: string | null
          sensitivity_factor_text?: string | null
          target_glucose_text?: string | null
          target_high_mgdl?: number
          target_low_mgdl?: number
          updated_at?: string
          updated_by?: string | null
          very_high_mgdl?: number
          very_low_mgdl?: number
        }
        Update: {
          administration_times?: string | null
          basal_insulin_text?: string | null
          carb_ratios?: Json
          clinical_instructions?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          last_review_date?: string | null
          patient_id?: string
          rapid_insulin_text?: string | null
          sensitivity_factor_text?: string | null
          target_glucose_text?: string | null
          target_high_mgdl?: number
          target_low_mgdl?: number
          updated_at?: string
          updated_by?: string | null
          very_high_mgdl?: number
          very_low_mgdl?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      food_catalog: {
        Row: {
          carbs_per_100g: number | null
          created_at: string
          created_by: string | null
          edible_portion_pct: number
          fat_per_100g: number | null
          id: string
          is_favorite: boolean
          kcal_per_100g: number | null
          name: string
          patient_id: string | null
          preparation: string | null
          protein_per_100g: number | null
          recipe_items: Json | null
          source: string
          source_reference: string | null
          state: string
        }
        Insert: {
          carbs_per_100g?: number | null
          created_at?: string
          created_by?: string | null
          edible_portion_pct?: number
          fat_per_100g?: number | null
          id?: string
          is_favorite?: boolean
          kcal_per_100g?: number | null
          name: string
          patient_id?: string | null
          preparation?: string | null
          protein_per_100g?: number | null
          recipe_items?: Json | null
          source: string
          source_reference?: string | null
          state?: string
        }
        Update: {
          carbs_per_100g?: number | null
          created_at?: string
          created_by?: string | null
          edible_portion_pct?: number
          fat_per_100g?: number | null
          id?: string
          is_favorite?: boolean
          kcal_per_100g?: number | null
          name?: string
          patient_id?: string | null
          preparation?: string | null
          protein_per_100g?: number | null
          recipe_items?: Json | null
          source?: string
          source_reference?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_catalog_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      glucose_readings: {
        Row: {
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          measured_at: string
          notes: string | null
          patient_id: string
          provider_id: string
          quality: string
          raw_payload: Json | null
          received_at: string
          source: Database["public"]["Enums"]["glucose_source"]
          trend: Database["public"]["Enums"]["glucose_trend"]
          unit: string
          value: number
          value_mgdl: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          measured_at: string
          notes?: string | null
          patient_id: string
          provider_id?: string
          quality?: string
          raw_payload?: Json | null
          received_at?: string
          source: Database["public"]["Enums"]["glucose_source"]
          trend?: Database["public"]["Enums"]["glucose_trend"]
          unit: string
          value: number
          value_mgdl: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          measured_at?: string
          notes?: string | null
          patient_id?: string
          provider_id?: string
          quality?: string
          raw_payload?: Json | null
          received_at?: string
          source?: Database["public"]["Enums"]["glucose_source"]
          trend?: Database["public"]["Enums"]["glucose_trend"]
          unit?: string
          value?: number
          value_mgdl?: number
        }
        Relationships: [
          {
            foreignKeyName: "glucose_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insulin_action_profiles: {
        Row: {
          created_at: string
          created_by: string
          effective_duration_max_minutes: number | null
          effective_duration_min_minutes: number | null
          effective_duration_text: string | null
          id: string
          insulin_id: string
          max_duration_minutes: number | null
          max_duration_text: string | null
          onset_max_minutes: number | null
          onset_min_minutes: number | null
          onset_text: string | null
          peak_max_minutes: number | null
          peak_min_minutes: number | null
          peak_text: string | null
          source_reference: string | null
          source_review_date: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string
          effective_duration_max_minutes?: number | null
          effective_duration_min_minutes?: number | null
          effective_duration_text?: string | null
          id?: string
          insulin_id: string
          max_duration_minutes?: number | null
          max_duration_text?: string | null
          onset_max_minutes?: number | null
          onset_min_minutes?: number | null
          onset_text?: string | null
          peak_max_minutes?: number | null
          peak_min_minutes?: number | null
          peak_text?: string | null
          source_reference?: string | null
          source_review_date?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_duration_max_minutes?: number | null
          effective_duration_min_minutes?: number | null
          effective_duration_text?: string | null
          id?: string
          insulin_id?: string
          max_duration_minutes?: number | null
          max_duration_text?: string | null
          onset_max_minutes?: number | null
          onset_min_minutes?: number | null
          onset_text?: string | null
          peak_max_minutes?: number | null
          peak_min_minutes?: number | null
          peak_text?: string | null
          source_reference?: string | null
          source_review_date?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "insulin_action_profiles_insulin_id_fkey"
            columns: ["insulin_id"]
            isOneToOne: false
            referencedRelation: "insulin_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      insulin_administrations: {
        Row: {
          administered_at: string
          confirmed_by_user: boolean
          created_at: string
          created_by: string
          dose_units: number
          glucose_before_mgdl: number | null
          id: string
          injection_site: string | null
          insulin_id: string
          is_superseded: boolean
          notes: string | null
          patient_id: string
          patient_insulin_id: string | null
          purpose: Database["public"]["Enums"]["administration_purpose"]
          recorded_by_name: string | null
          status: Database["public"]["Enums"]["administration_status"]
          supersedes_id: string | null
        }
        Insert: {
          administered_at: string
          confirmed_by_user?: boolean
          created_at?: string
          created_by?: string
          dose_units: number
          glucose_before_mgdl?: number | null
          id?: string
          injection_site?: string | null
          insulin_id: string
          is_superseded?: boolean
          notes?: string | null
          patient_id: string
          patient_insulin_id?: string | null
          purpose: Database["public"]["Enums"]["administration_purpose"]
          recorded_by_name?: string | null
          status?: Database["public"]["Enums"]["administration_status"]
          supersedes_id?: string | null
        }
        Update: {
          administered_at?: string
          confirmed_by_user?: boolean
          created_at?: string
          created_by?: string
          dose_units?: number
          glucose_before_mgdl?: number | null
          id?: string
          injection_site?: string | null
          insulin_id?: string
          is_superseded?: boolean
          notes?: string | null
          patient_id?: string
          patient_insulin_id?: string | null
          purpose?: Database["public"]["Enums"]["administration_purpose"]
          recorded_by_name?: string | null
          status?: Database["public"]["Enums"]["administration_status"]
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insulin_administrations_insulin_id_fkey"
            columns: ["insulin_id"]
            isOneToOne: false
            referencedRelation: "insulin_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insulin_administrations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insulin_administrations_patient_insulin_id_fkey"
            columns: ["patient_insulin_id"]
            isOneToOne: false
            referencedRelation: "patient_insulins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insulin_administrations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "insulin_administrations"
            referencedColumns: ["id"]
          },
        ]
      }
      insulin_catalog: {
        Row: {
          active_ingredient: string | null
          brand_name: string
          concentration: string | null
          created_at: string
          created_by: string
          id: string
          manufacturer: string | null
          pharmacological_class: string | null
          presentation: string | null
          route: string | null
          updated_at: string
        }
        Insert: {
          active_ingredient?: string | null
          brand_name: string
          concentration?: string | null
          created_at?: string
          created_by?: string
          id?: string
          manufacturer?: string | null
          pharmacological_class?: string | null
          presentation?: string | null
          route?: string | null
          updated_at?: string
        }
        Update: {
          active_ingredient?: string | null
          brand_name?: string
          concentration?: string | null
          created_at?: string
          created_by?: string
          id?: string
          manufacturer?: string | null
          pharmacological_class?: string | null
          presentation?: string | null
          route?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ketone_readings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          measured_at: string
          method: Database["public"]["Enums"]["ketone_method"]
          notes: string | null
          patient_id: string
          qualitative: string | null
          unit: string
          value: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          measured_at: string
          method: Database["public"]["Enums"]["ketone_method"]
          notes?: string | null
          patient_id: string
          qualitative?: string | null
          unit: string
          value?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          measured_at?: string
          method?: Database["public"]["Enums"]["ketone_method"]
          notes?: string | null
          patient_id?: string
          qualitative?: string | null
          unit?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ketone_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_entries: {
        Row: {
          created_at: string
          created_by: string
          eaten_at: string
          favorite_name: string | null
          has_missing_values: boolean
          id: string
          is_favorite: boolean
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes: string | null
          patient_id: string
          total_carbs_g: number
          total_fat_g: number | null
          total_kcal: number | null
          total_protein_g: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          eaten_at: string
          favorite_name?: string | null
          has_missing_values?: boolean
          id?: string
          is_favorite?: boolean
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          patient_id: string
          total_carbs_g?: number
          total_fat_g?: number | null
          total_kcal?: number | null
          total_protein_g?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          eaten_at?: string
          favorite_name?: string | null
          has_missing_values?: boolean
          id?: string
          is_favorite?: boolean
          meal_type?: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          patient_id?: string
          total_carbs_g?: number
          total_fat_g?: number | null
          total_kcal?: number | null
          total_protein_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          carbs_g: number | null
          fat_g: number | null
          food_id: string | null
          food_name: string
          food_source: string
          grams: number
          id: string
          kcal: number | null
          meal_id: string
          patient_id: string
          protein_g: number | null
        }
        Insert: {
          carbs_g?: number | null
          fat_g?: number | null
          food_id?: string | null
          food_name: string
          food_source: string
          grams: number
          id?: string
          kcal?: number | null
          meal_id: string
          patient_id: string
          protein_g?: number | null
        }
        Update: {
          carbs_g?: number | null
          fat_g?: number | null
          food_id?: string | null
          food_name?: string
          food_source?: string
          grams?: number
          id?: string
          kcal?: number | null
          meal_id?: string
          patient_id?: string
          protein_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_insulins: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          ended_on: string | null
          id: string
          insulin_id: string
          notes: string | null
          patient_id: string
          prescribed_dose_text: string | null
          prescribed_times: string | null
          role: string
          started_on: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string
          ended_on?: string | null
          id?: string
          insulin_id: string
          notes?: string | null
          patient_id: string
          prescribed_dose_text?: string | null
          prescribed_times?: string | null
          role: string
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          ended_on?: string | null
          id?: string
          insulin_id?: string
          notes?: string | null
          patient_id?: string
          prescribed_dose_text?: string | null
          prescribed_times?: string | null
          role?: string
          started_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_insulins_insulin_id_fkey"
            columns: ["insulin_id"]
            isOneToOne: false
            referencedRelation: "insulin_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_insulins_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_members: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_members_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string
          id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by?: string
          id?: string
          nickname: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string
          id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_patient_member_by_email: {
        Args: {
          _email: string
          _patient: string
          _role: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      save_meal_atomic: {
        Args: {
          p_patient_id: string
          p_meal: Json
          p_items: Json
        }
        Returns: string
      }
      can_write_patient: { Args: { _patient: string }; Returns: boolean }
      is_patient_caregiver: { Args: { _patient: string }; Returns: boolean }
      is_patient_member: { Args: { _patient: string }; Returns: boolean }
    }
    Enums: {
      administration_purpose: "basal" | "meal" | "correction" | "combined"
      administration_status: "performed" | "planned"
      glucose_source: "simulation" | "manual" | "external"
      glucose_trend:
        | "rising_fast"
        | "rising"
        | "stable"
        | "falling"
        | "falling_fast"
        | "unknown"
      ketone_method: "blood" | "urine"
      meal_type: "breakfast" | "lunch" | "snack" | "dinner" | "supper" | "other"
      member_role: "caregiver" | "patient" | "professional_readonly"
      validation_status: "not_validated" | "under_review" | "validated"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      administration_purpose: ["basal", "meal", "correction", "combined"],
      administration_status: ["performed", "planned"],
      glucose_source: ["simulation", "manual", "external"],
      glucose_trend: [
        "rising_fast",
        "rising",
        "stable",
        "falling",
        "falling_fast",
        "unknown",
      ],
      ketone_method: ["blood", "urine"],
      meal_type: ["breakfast", "lunch", "snack", "dinner", "supper", "other"],
      member_role: ["caregiver", "patient", "professional_readonly"],
      validation_status: ["not_validated", "under_review", "validated"],
    },
  },
} as const
