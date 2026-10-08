import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "./domain/types";
import type { DataStore } from "./data/store";
import { cloudStore } from "./data/cloud-store";
import { getDemoStore, resetDemoStore } from "./data/demo-store";

const DEMO_FLAG = "glycare-demo-mode"; // only a UI flag; no clinical data is stored
const PATIENT_FLAG = "glycare-active-patient";

interface AppState {
  ready: boolean;
  session: Session | null;
  mode: "demo" | "cloud" | "none";
  store: DataStore | null;
  patients: Patient[];
  patientsLoading: boolean;
  patient: Patient | null;
  readOnly: boolean;
  setPatientId: (id: string) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [patientId, setPatientIdState] = useState<string | null>(null);

  useEffect(() => {
    setDemo(sessionStorage.getItem(DEMO_FLAG) === "1");
    setPatientIdState(localStorage.getItem(PATIENT_FLAG));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        qc.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const mode: AppState["mode"] = session ? "cloud" : demo ? "demo" : "none";
  const store = mode === "cloud" ? cloudStore : mode === "demo" ? getDemoStore() : null;

  const patientsQ = useQuery({
    queryKey: [mode, session?.user.id ?? "anon", "patients"],
    queryFn: () => store!.listPatients(),
    enabled: !!store,
  });
  const patients = patientsQ.data ?? [];
  const patient = patients.find((p) => p.id === patientId) ?? patients[0] ?? null;

  const setPatientId = useCallback((id: string) => {
    localStorage.setItem(PATIENT_FLAG, id);
    setPatientIdState(id);
  }, []);
  const enterDemo = useCallback(() => {
    sessionStorage.setItem(DEMO_FLAG, "1");
    resetDemoStore();
    setDemo(true);
  }, []);
  const exitDemo = useCallback(() => {
    sessionStorage.removeItem(DEMO_FLAG);
    resetDemoStore();
    qc.clear();
    setDemo(false);
  }, [qc]);
  const signOut = useCallback(async () => {
    await qc.cancelQueries();
    qc.clear();
    localStorage.removeItem(PATIENT_FLAG);
    await supabase.auth.signOut();
  }, [qc]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      session,
      mode,
      store,
      patients,
      patientsLoading: patientsQ.isLoading,
      patient,
      readOnly: patient?.role === "professional_readonly",
      setPatientId,
      enterDemo,
      exitDemo,
      signOut,
    }),
    [ready, session, mode, store, patients, patientsQ.isLoading, patient, setPatientId, enterDemo, exitDemo, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}

/** Store + patient guaranteed (used inside the shell after onboarding). */
export function usePatientStore() {
  const { store, patient, mode, readOnly } = useApp();
  if (!store || !patient) throw new Error("Paciente não selecionado");
  return { store, patient, pid: patient.id, mode, readOnly, key: [mode, patient.id] as const };
}
