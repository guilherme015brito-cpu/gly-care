import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { History, Plus, Pencil, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, EmptyState, ErrorState, LoadingState } from "@/components/glycare/ui-bits";
import { Segmented } from "@/components/glycare/form";
import { Button } from "@/components/ui/button";
import { useAdministrations, useAudit, useCatalog, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { PURPOSE_LABEL, fmtDateTime } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/monitor/insulina/")({
  head: () => ({
    meta: [
      { title: "Histórico de aplicações — GlyCare" },
      { name: "description", content: "Histórico de aplicações de insulina e trilha de auditoria." },
      { property: "og:title", content: "Histórico de aplicações — GlyCare" },
      { property: "og:description", content: "Histórico de aplicações de insulina e trilha de auditoria." },
    ],
  }),
  component: AdminHistory,
});

const TABLE_LABEL: Record<string, string> = {
  insulin_administrations: "Aplicação de insulina",
  glucose_readings: "Glicemia",
  ketone_readings: "Cetonas",
  meal_entries: "Refeição",
  meal_items: "Item de refeição",
  clinical_settings: "Parâmetros",
  patient_insulins: "Insulina em uso",
};

function AdminHistory() {
  const { readOnly } = usePatientStore();
  const [tab, setTab] = useState<"list" | "audit">("list");
  const admins = useAdministrations(200);
  const catalog = useCatalog();
  const audit = useAudit();
  const markDone = useStoreMutation((s, _p, id: string) => s.markAdministrationPerformed(id), "Marcada como realizada");
  const name = (id: string) => catalog.data?.find((c) => c.id === id)?.brand_name ?? "Insulina";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aplicações de insulina"
        action={!readOnly && <Button asChild size="sm"><Link to="/monitor/insulina/nova"><Plus aria-hidden /> Nova</Link></Button>}
      />
      <Segmented label="Visualização" value={tab} onChange={setTab} options={[{ value: "list", label: "Histórico" }, { value: "audit", label: "Auditoria" }]} />

      {tab === "list" ? (
        <Card>
          {admins.isLoading ? <LoadingState /> : admins.error ? <ErrorState error={admins.error} /> : !admins.data?.length ? <EmptyState title="Nenhuma aplicação registrada" /> : (
            <ul className="divide-y">
              {admins.data.map((a) => (
                <li key={a.id} className={cn("py-3", a.is_superseded && "opacity-55")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{a.dose_units.toLocaleString("pt-BR")} UI · {name(a.insulin_id)}</p>
                      <p className="text-sm text-muted-foreground">{PURPOSE_LABEL[a.purpose]} · {fmtDateTime(a.administered_at)}</p>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs font-semibold">
                        <span className={cn("rounded-full px-2 py-0.5", a.status === "performed" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground")}>
                          {a.status === "performed" ? "Realizada (informada)" : "Planejada — não aplicada"}
                        </span>
                        {a.is_superseded && <span className="rounded-full bg-muted px-2 py-0.5">Corrigida — substituída</span>}
                        {a.supersedes_id && <span className="rounded-full bg-info-soft px-2 py-0.5 text-info">Correção</span>}
                      </div>
                      {(a.glucose_before_mgdl || a.injection_site || a.notes || a.recorded_by_name) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[a.glucose_before_mgdl && `Glicemia antes: ${a.glucose_before_mgdl} mg/dL`, a.injection_site && `Local: ${a.injection_site}`, a.recorded_by_name && `Por: ${a.recorded_by_name}`, a.notes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {!readOnly && !a.is_superseded && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button asChild variant="ghost" size="sm" aria-label="Corrigir registro">
                          <Link to="/monitor/insulina/nova" search={{ corrige: a.id }}><Pencil aria-hidden /> Corrigir</Link>
                        </Button>
                        {a.status === "planned" && (
                          <Button variant="soft" size="sm" onClick={() => { if (confirm("Confirmar que esta aplicação planejada realmente ocorreu?")) markDone.mutate(a.id); }}>
                            <CheckCircle2 aria-hidden /> Realizada
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><History className="h-4 w-4" aria-hidden /> Toda criação e alteração de registros clínicos fica registrada aqui.</p>
          {audit.isLoading ? <LoadingState /> : audit.error ? <ErrorState error={audit.error} /> : !audit.data?.length ? <EmptyState title="Sem alterações registradas" /> : (
            <ul className="divide-y">
              {audit.data.map((e) => (
                <li key={e.id} className="py-2.5 text-sm">
                  <p className="font-semibold">{TABLE_LABEL[e.table_name] ?? e.table_name} · {e.action === "INSERT" ? "criado" : e.action === "UPDATE" ? "alterado" : "removido"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(e.changed_at)} · registro {e.record_id.slice(0, 8)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
