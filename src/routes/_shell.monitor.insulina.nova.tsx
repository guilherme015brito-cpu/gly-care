import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Syringe } from "lucide-react";
import { z } from "zod";
import { PageHeader, Card, Notice, LoadingState, EmptyState } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, selectCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAdministrations, useCatalog, usePatientInsulins, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { administrationSchema, findPossibleDuplicates, type AdministrationInput } from "@/lib/validation";
import { PURPOSE_LABEL, fmtDateTime, nowLocalInput } from "@/lib/domain/labels";
import type { AdministrationPurpose, AdministrationStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/_shell/monitor/insulina/nova")({
  validateSearch: z.object({ corrige: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Registrar aplicação de insulina — GlyCare" },
      { name: "description", content: "Registro de aplicação de insulina realizada ou planejada." },
      { property: "og:title", content: "Registrar aplicação de insulina — GlyCare" },
      { property: "og:description", content: "Registro de aplicação de insulina realizada ou planejada." },
    ],
  }),
  component: NewAdministration,
});

function NewAdministration() {
  const { corrige } = Route.useSearch();
  const { readOnly } = usePatientStore();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const pis = usePatientInsulins();
  const admins = useAdministrations(100);
  const original = admins.data?.find((a) => a.id === corrige);

  const [form, setForm] = useState(() => ({
    insulin_id: "",
    dose: "",
    administered_at: nowLocalInput(),
    purpose: "meal" as AdministrationPurpose,
    status: "performed" as AdministrationStatus,
    confirmed: false,
    glucose_before: "",
    injection_site: "",
    notes: "",
    recorded_by_name: "",
  }));
  const [loadedOriginal, setLoadedOriginal] = useState(false);
  if (original && !loadedOriginal) {
    setLoadedOriginal(true);
    const d = new Date(original.administered_at);
    setForm({
      insulin_id: original.insulin_id,
      dose: String(original.dose_units).replace(".", ","),
      administered_at: nowLocalInput(d),
      purpose: original.purpose,
      status: original.status,
      confirmed: false,
      glucose_before: original.glucose_before_mgdl ? String(original.glucose_before_mgdl) : "",
      injection_site: original.injection_site ?? "",
      notes: original.notes ?? "",
      recorded_by_name: original.recorded_by_name ?? "",
    });
  }
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<AdministrationInput | null>(null);

  const add = useStoreMutation((s, pid, v: AdministrationInput) => s.addAdministration(pid, v, corrige), corrige ? "Correção registrada (original preservado no histórico)" : "Aplicação registrada");

  // Patient's active insulins first; full catalog as fallback
  const options = useMemo(() => {
    const active = new Set((pis.data ?? []).filter((p) => p.active).map((p) => p.insulin_id));
    const all = catalog.data ?? [];
    return [...all.filter((c) => active.has(c.id)), ...all.filter((c) => !active.has(c.id))].map((c) => ({ ...c, inUse: active.has(c.id) }));
  }, [catalog.data, pis.data]);

  const duplicates = pending ? findPossibleDuplicates((admins.data ?? []).filter((a) => a.id !== corrige), pending) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = administrationSchema.safeParse(form);
    if (!r.success) return setErrors(zodErrors(r.error));
    setErrors({});
    setPending(r.data);
  }

  if (readOnly) return (<><PageHeader title="Registrar aplicação" /><Notice>Seu acesso é somente leitura.</Notice></>);
  if (catalog.isLoading) return <LoadingState />;
  if (!options.length)
    return (
      <>
        <PageHeader title="Registrar aplicação" />
        <EmptyState title="Nenhuma insulina cadastrada">
          <Link to="/config/insulinas" className="font-semibold text-primary">Cadastrar insulina</Link>
        </EmptyState>
      </>
    );

  return (
    <div className="space-y-4">
      <PageHeader title={corrige ? "Corrigir registro" : "Registrar aplicação"} subtitle="Insulina administrada ou planejada" />
      {corrige && <Notice tone="info">O registro original não será apagado: ele ficará marcado como corrigido e visível no histórico de auditoria.</Notice>}
      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="st" label="Situação">
            <Segmented label="Situação" value={form.status} onChange={(status) => setForm({ ...form, status, confirmed: false })} options={[{ value: "performed", label: "Realizada" }, { value: "planned", label: "Planejada" }]} />
          </Field>
          <Field id="ins" label="Insulina utilizada" error={errors["insulin_id"]}>
            <select id="ins" className={selectCls} value={form.insulin_id} onChange={(e) => setForm({ ...form, insulin_id: e.target.value })} aria-invalid={!!errors["insulin_id"]}>
              <option value="">Selecione…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.brand_name}{o.concentration ? ` (${o.concentration})` : ""}{o.inUse ? " — em uso" : ""}</option>
              ))}
            </select>
          </Field>
          <Field id="dose" label="Dose administrada (UI)" hint="Unidades internacionais. Ex.: 4 ou 4,5" error={errors["dose"]}>
            <Input id="dose" inputMode="decimal" className={`${inputCls} text-2xl font-bold`} value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} aria-invalid={!!errors["dose"]} />
          </Field>
          <Field id="when" label="Data e horário efetivos" error={errors["administered_at"]}>
            <Input id="when" type="datetime-local" className={inputCls} value={form.administered_at} onChange={(e) => setForm({ ...form, administered_at: e.target.value })} />
          </Field>
          <Field id="pur" label="Tipo de aplicação" error={errors["purpose"]}>
            <Segmented label="Tipo" cols={2} value={form.purpose} onChange={(purpose) => setForm({ ...form, purpose })} options={(Object.keys(PURPOSE_LABEL) as AdministrationPurpose[]).map((v) => ({ value: v, label: PURPOSE_LABEL[v] }))} />
          </Field>
          <Field id="gb" label="Glicemia antes da aplicação (mg/dL)" optional error={errors["glucose_before"]}>
            <Input id="gb" inputMode="numeric" className={inputCls} value={form.glucose_before} onChange={(e) => setForm({ ...form, glucose_before: e.target.value })} />
          </Field>
          <Field id="site" label="Local da aplicação" optional error={errors["injection_site"]}>
            <Input id="site" className={inputCls} placeholder="Ex.: abdômen, braço" value={form.injection_site} onChange={(e) => setForm({ ...form, injection_site: e.target.value })} maxLength={60} />
          </Field>
          <Field id="by" label="Responsável pelo registro" optional error={errors["recorded_by_name"]}>
            <Input id="by" className={inputCls} value={form.recorded_by_name} onChange={(e) => setForm({ ...form, recorded_by_name: e.target.value })} maxLength={100} />
          </Field>
          <Field id="obs" label="Observações" optional error={errors["notes"]}>
            <Textarea id="obs" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />
          </Field>
          {form.status === "performed" && (
            <div>
              <label className="flex min-h-12 items-start gap-3 rounded-xl border p-3">
                <Checkbox checked={form.confirmed} onCheckedChange={(v) => setForm({ ...form, confirmed: v === true })} className="mt-0.5 h-6 w-6" aria-describedby="confirmed-err" />
                <span className="text-sm">Confirmo que esta aplicação <strong>realmente ocorreu</strong>, com a dose e o horário informados.</span>
              </label>
              {errors["confirmed"] && <p id="confirmed-err" role="alert" className="mt-1 text-sm font-medium text-destructive">{errors["confirmed"]}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">O registro documenta o que foi informado; não comprova que a dose foi administrada.</p>
          <Button type="submit" size="lg" className="w-full"><Syringe aria-hidden /> Revisar e salvar</Button>
        </form>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-foreground">
                {pending && (
                  <>
                    <p><strong>{pending.status === "performed" ? "Aplicação REALIZADA" : "Aplicação PLANEJADA"}</strong></p>
                    <p>{options.find((o) => o.id === pending.insulin_id)?.brand_name}</p>
                    <p className="text-2xl font-extrabold">{pending.dose.toLocaleString("pt-BR")} UI</p>
                    <p>{PURPOSE_LABEL[pending.purpose]} · {fmtDateTime(new Date(pending.administered_at).toISOString())}</p>
                  </>
                )}
                {duplicates.length > 0 && (
                  <div className="flex gap-2 rounded-xl bg-warning-soft p-3 text-warning-foreground" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>Possível duplicidade: já existe {duplicates.length} aplicação(ões) desta insulina perto deste horário ({duplicates.map((d) => `${d.dose_units} UI às ${fmtDateTime(d.administered_at)}`).join("; ")}). Se este registro é legítimo, você pode salvar mesmo assim.</span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Voltar e revisar</AlertDialogCancel>
            <AlertDialogAction
              className="h-12"
              onClick={() => pending && add.mutate(pending, { onSuccess: () => navigate({ to: "/monitor/insulina" }) })}
              disabled={add.isPending}
            >
              {duplicates.length ? "Salvar mesmo assim" : "Confirmar e salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
