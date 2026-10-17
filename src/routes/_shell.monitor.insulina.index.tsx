import { InjectionSiteField } from "@/components/glycare/InjectionSiteField";
import { normalizeInjectionSite } from "@/lib/injection-sites";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { History, Plus, Pencil, CheckCircle2, Trash2 } from "lucide-react";
import {
  PageHeader,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/glycare/ui-bits";
import { Segmented } from "@/components/glycare/form";
import { Button } from "@/components/ui/button";
import { useAdministrations, useAudit, useCatalog, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { PURPOSE_LABEL, fmtDateTime, nowLocalInput } from "@/lib/domain/labels";
import type { InsulinAdministration } from "@/lib/domain/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, inputCls } from "@/components/glycare/form";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/monitor/insulina/")({
  head: () => ({
    meta: [
      { title: "Histórico de aplicações — GlyCare" },
      {
        name: "description",
        content: "Histórico de aplicações de insulina e trilha de auditoria.",
      },
      { property: "og:title", content: "Histórico de aplicações — GlyCare" },
      {
        property: "og:description",
        content: "Histórico de aplicações de insulina e trilha de auditoria.",
      },
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
  const [pending, setPending] = useState<InsulinAdministration | null>(null);
  const [appliedAt, setAppliedAt] = useState(nowLocalInput());
  const [injectionSite, setInjectionSite] = useState("");
  const [removing, setRemoving] = useState<InsulinAdministration | null>(null);
  const remove = useStoreMutation(
    (s, pid, id: string) => s.deleteAdministration(pid, id),
    "Registro de insulina excluído",
  );
  const admins = useAdministrations(200);
  const catalog = useCatalog();
  const audit = useAudit();
  const markDone = useStoreMutation(
    (s, _p, v: { id: string; at: string; site: string }) =>
      s.markAdministrationPerformed(v.id, v.at, v.site),
    "Aplicação confirmada no horário informado",
  );
  const name = (id: string) => catalog.data?.find((c) => c.id === id)?.brand_name ?? "Insulina";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aplicações de insulina"
        action={
          !readOnly && (
            <Button asChild size="sm">
              <Link to="/monitor/insulina/nova">
                <Plus aria-hidden /> Nova
              </Link>
            </Button>
          )
        }
      />
      <Segmented
        label="Visualização"
        value={tab}
        onChange={setTab}
        options={[
          { value: "list", label: "Histórico" },
          { value: "audit", label: "Auditoria" },
        ]}
      />

      {tab === "list" ? (
        <Card>
          {admins.isLoading ? (
            <LoadingState />
          ) : admins.error ? (
            <ErrorState error={admins.error} />
          ) : !admins.data?.length ? (
            <EmptyState title="Nenhuma aplicação registrada" />
          ) : (
            <ul className="divide-y">
              {admins.data.map((a) => (
                <li key={a.id} className={cn("py-3", a.is_superseded && "opacity-55")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {a.dose_units.toLocaleString("pt-BR")} UI · {name(a.insulin_id)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {PURPOSE_LABEL[a.purpose]} · {fmtDateTime(a.administered_at)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs font-semibold">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5",
                            a.status === "performed"
                              ? "bg-success-soft text-success"
                              : "bg-warning-soft text-warning-foreground",
                          )}
                        >
                          {a.status === "performed"
                            ? "Realizada (informada)"
                            : "Planejada — não aplicada"}
                        </span>
                        {a.is_superseded && (
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            Corrigida — substituída
                          </span>
                        )}
                        {a.supersedes_id && (
                          <span className="rounded-full bg-info-soft px-2 py-0.5 text-info">
                            Correção
                          </span>
                        )}
                      </div>
                      {(a.glucose_before_mgdl ||
                        a.injection_site ||
                        a.notes ||
                        a.recorded_by_name) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            a.glucose_before_mgdl &&
                              `Glicemia antes: ${a.glucose_before_mgdl} mg/dL`,
                            a.injection_site && `Local: ${a.injection_site}`,
                            a.recorded_by_name && `Por: ${a.recorded_by_name}`,
                            a.notes,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    {!readOnly && !a.is_superseded && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button asChild variant="ghost" size="sm" aria-label="Corrigir registro">
                          <Link to="/monitor/insulina/nova" search={{ corrige: a.id }}>
                            <Pencil aria-hidden /> Corrigir
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(a)}>
                          <Trash2 aria-hidden /> Excluir
                        </Button>
                        {a.status === "planned" && (
                          <Button
                            variant="soft"
                            size="sm"
                            disabled={markDone.isPending}
                            onClick={() => {
                              setAppliedAt(nowLocalInput());
                              setInjectionSite(normalizeInjectionSite(a.injection_site) ?? "");
                              setPending(a);
                            }}
                          >
                            <CheckCircle2 aria-hidden /> Confirmar aplicação
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
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" aria-hidden /> Toda criação e alteração de registros
            clínicos fica registrada aqui.
          </p>
          {audit.isLoading ? (
            <LoadingState />
          ) : audit.error ? (
            <ErrorState error={audit.error} />
          ) : !audit.data?.length ? (
            <EmptyState title="Sem alterações registradas" />
          ) : (
            <ul className="divide-y">
              {audit.data.map((e) => (
                <li key={e.id} className="py-2.5 text-sm">
                  <p className="font-semibold">
                    {TABLE_LABEL[e.table_name] ?? e.table_name} ·{" "}
                    {e.action === "INSERT"
                      ? "criado"
                      : e.action === "UPDATE"
                        ? "alterado"
                        : "removido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(e.changed_at)} · registro {e.record_id.slice(0, 8)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Dialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir registro de insulina?</DialogTitle>
            <DialogDescription>
              O registro será removido do histórico ativo e dos gráficos. A trilha de auditoria será
              preservada.
            </DialogDescription>
          </DialogHeader>
          {removing && (
            <p>
              {name(removing.insulin_id)} · {removing.dose_units} UI ·{" "}
              {fmtDateTime(removing.administered_at)}
            </p>
          )}
          {remove.error && <ErrorState error={remove.error} />}
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (removing && !remove.isPending)
                remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
            }}
          >
            {remove.isPending ? "Excluindo…" : "Excluir registro"}
          </Button>
          <Button variant="outline" disabled={remove.isPending} onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !markDone.isPending) setPending(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
          <DialogHeader>
            <DialogTitle>Confirmar aplicação</DialogTitle>
            <DialogDescription>Registrar o horário em que a aplicação ocorreu.</DialogDescription>
          </DialogHeader>
          {pending && (
            <>
              <p className="font-semibold">
                {name(pending.insulin_id)} · {pending.dose_units.toLocaleString("pt-BR")} UI
              </p>
              <Field id="pending-applied-at" label="Horário efetivo da aplicação">
                <Input
                  id="pending-applied-at"
                  type="datetime-local"
                  className={inputCls}
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                />
              </Field>
              <InjectionSiteField
                value={injectionSite}
                onChange={setInjectionSite}
                at={appliedAt}
                excludeId={pending.id}
              />
              {markDone.error && <ErrorState error={markDone.error} />}
              <Button
                disabled={
                  markDone.isPending ||
                  !injectionSite ||
                  !Number.isFinite(new Date(appliedAt).getTime()) ||
                  new Date(appliedAt).getTime() > Date.now() + 5 * 60000
                }
                onClick={() => {
                  if (!markDone.isPending)
                    markDone.mutate(
                      {
                        id: pending.id,
                        at: new Date(appliedAt).toISOString(),
                        site: injectionSite,
                      },
                      { onSuccess: () => setPending(null) },
                    );
                }}
              >
                <CheckCircle2 aria-hidden /> Sim, aplicação realizada
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
