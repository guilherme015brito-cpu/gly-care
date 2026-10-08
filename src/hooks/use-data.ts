import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePatientStore } from "@/lib/app-context";
import type { DataStore } from "@/lib/data/store";

export const RANGE_HOURS = { "3h": 3, "6h": 6, "12h": 12, "24h": 24, "7d": 168 } as const;
export type RangeKey = keyof typeof RANGE_HOURS;

export function useGlucose(hours: number) {
  const { store, pid, key } = usePatientStore();
  return useQuery({
    queryKey: [...key, "glucose", hours],
    queryFn: () => store.listGlucose(pid, new Date(Date.now() - hours * 3600000)),
    refetchInterval: 60000,
  });
}
export function useAdministrations(limit = 50) {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "admins", limit], queryFn: () => store.listAdministrations(pid, limit) });
}
export function useCatalog() {
  const { store, key } = usePatientStore();
  return useQuery({ queryKey: [key[0], "catalog"], queryFn: () => store.listCatalog() });
}
export function useActionProfiles() {
  const { store, key } = usePatientStore();
  return useQuery({ queryKey: [key[0], "action-profiles"], queryFn: () => store.listActionProfiles() });
}
export function usePatientInsulins() {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "patient-insulins"], queryFn: () => store.listPatientInsulins(pid) });
}
export function useKetones(limit = 50) {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "ketones", limit], queryFn: () => store.listKetones(pid, limit) });
}
export function useFoods() {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "foods"], queryFn: () => store.listFoods(pid) });
}
export function useMeals(limit = 50) {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "meals", limit], queryFn: () => store.listMeals(pid, limit) });
}
export function useSettings() {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "settings"], queryFn: () => store.getSettings(pid) });
}
export function useMembers() {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "members"], queryFn: () => store.listMembers(pid) });
}
export function useAudit() {
  const { store, pid, key } = usePatientStore();
  return useQuery({ queryKey: [...key, "audit"], queryFn: () => store.listAudit(pid) });
}

/** Generic mutation: invalidates everything for this patient; never claims success on failure. */
export function useStoreMutation<V>(fn: (store: DataStore, pid: string, v: V) => Promise<unknown>, successMsg?: string) {
  const { store, pid } = usePatientStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      if (typeof navigator !== "undefined" && !navigator.onLine && store.mode === "cloud") {
        throw new Error("Sem conexão. O registro NÃO foi salvo. Tente quando estiver online.");
      }
      return fn(store, pid, v);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      if (successMsg) toast.success(successMsg);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });
}
