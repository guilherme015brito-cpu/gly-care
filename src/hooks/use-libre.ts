import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePatientStore } from "@/lib/app-context";

export function useLibreStatus() {
  const { store, pid, key, mode } = usePatientStore();
  return useQuery({
    queryKey: [...key, "libre-status"],
    enabled: mode === "cloud",
    retry: false,
    refetchInterval: 60000,
    queryFn: async () => {
      const result = await store.libre({ action: "status", pid });
      if (result.error || !result.status)
        throw new Error(result.error ?? "Não foi possível consultar a conexão Libre.");
      return result.status;
    },
  });
}

export function useLibreSync(enabled: boolean) {
  const { store, pid, key, mode } = usePatientStore();
  const qc = useQueryClient();
  return useQuery({
    queryKey: [...key, "libre-sync"],
    enabled: mode === "cloud" && enabled,
    retry: false,
    refetchInterval: 60000,
    queryFn: async () => {
      const result = await store.libre({ action: "sync", pid });
      await qc.invalidateQueries({ queryKey: [...key, "libre-status"] });
      if (result.error) throw new Error(result.error);
      await qc.invalidateQueries({ queryKey: [...key, "glucose"] });
      return result.inserted ?? 0;
    },
  });
}
