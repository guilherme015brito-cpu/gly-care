import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Droplet } from "lucide-react";
import { PageHeader, Card, CardTitle, EmptyState, ErrorState, LoadingState, SourceBadge, BandBadge, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGlucose, useSettings, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { manualGlucoseSchema } from "@/lib/validation";
import { ManualGlucoseProvider } from "@/lib/glucose/providers";
import { classifyGlucose } from "@/lib/glucose/status";
import { TREND_LABEL, fmtDateTime, nowLocalInput } from "@/lib/domain/labels";

export const Route = createFileRoute("/_shell/monitor/glicemia")({
  head: () => ({
    meta: [
      { title: "Histórico de glicemia — GlyCare" },
      { name: "description", content: "Registre glicemias manuais e consulte o histórico." },
      { property: "og:title", content: "Histórico de glicemia — GlyCare" },
      { property: "og:description", content: "Registre glicemias manuais e consulte o histórico." },
    ],
  }),
  component: GlucosePage,
});

const manual = new ManualGlucoseProvider();

function GlucosePage() {
  const { readOnly } = usePatientStore();
  const list = useGlucose(168);
  const settings = useSettings();
  const [form, setForm] = useState({ value: "", unit: "mg/dL" as "mg/dL" | "mmol/L", measured_at: nowLocalInput(), notes: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [onlyManual, setOnlyManual] = useState<"all" | "manual">("all");
  const add = useStoreMutation(async (s, pid, v: ReturnType<typeof manual.build>) => {
    const n = await s.ingestGlucose(pid, [v]);
    if (n === 0) throw new Error("Já existe uma leitura manual exatamente neste horário. Nada foi duplicado.");
  }, "Glicemia registrada");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = manualGlucoseSchema.safeParse(form);
    if (!r.success) return setErrors(zodErrors(r.error));
    setErrors({});
    add.mutate(manual.build({ ...r.data, measured_at: new Date(r.data.measured_at).toISOString() }), {
      onSuccess: () => setForm({ ...form, value: "", notes: "", measured_at: nowLocalInput() }),
    });
  }

  const rows = [...(list.data ?? [])].reverse().filter((r) => onlyManual === "all" || r.source === "manual");

  return (
    <div className="space-y-4">
      <PageHeader title="Glicemia" subtitle="Registro manual e histórico (7 dias)" />
      {!readOnly && (
        <Card>
          <CardTitle icon={<Droplet className="h-4 w-4" />}>Registrar glicemia manual</CardTitle>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Segmented label="Unidade" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} options={[{ value: "mg/dL", label: "mg/dL" }, { value: "mmol/L", label: "mmol/L" }]} />
            <Field id="gv" label="Valor medido" error={errors.value}>
              <Input id="gv" inputMode="decimal" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} aria-invalid={!!errors.value} />
            </Field>
            <Field id="gt" label="Data e horário da medição" error={errors.measured_at}>
              <Input id="gt" type="datetime-local" className={inputCls} value={form.measured_at} onChange={(e) => setForm({ ...form, measured_at: e.target.value })} />
            </Field>
            <Field id="gn" label="Observações" optional error={errors.notes}>
              <Textarea id="gn" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={add.isPending}>{add.isPending ? "Salvando…" : "Salvar leitura"}</Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Histórico</CardTitle>
        <div className="mb-3"><Segmented label="Filtro" value={onlyManual} onChange={setOnlyManual} options={[{ value: "all", label: "Todas" }, { value: "manual", label: "Só manuais" }]} /></div>
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} /> : !rows.length ? <EmptyState title="Sem leituras" /> : (
          <>
            {rows.some((r) => r.source === "simulation") && <div className="mb-2"><Notice tone="sim">Leituras de simulação não representam a paciente.</Notice></div>}
            <ul className="divide-y">
              {rows.slice(0, 150).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-bold">{Math.round(r.value_mgdl)} mg/dL {r.unit !== "mg/dL" && <span className="text-xs font-normal text-muted-foreground">({r.value} {r.unit})</span>}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(r.measured_at)} · {TREND_LABEL[r.trend]}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {settings.data && <BandBadge band={classifyGlucose(r.value_mgdl, settings.data)} />}
                    <SourceBadge source={r.source} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
