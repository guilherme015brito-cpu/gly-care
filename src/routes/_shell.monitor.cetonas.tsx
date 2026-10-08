import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TestTube, ShieldAlert } from "lucide-react";
import { PageHeader, Card, CardTitle, EmptyState, ErrorState, LoadingState, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useKetones, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { ketoneSchema, type KetoneInput } from "@/lib/validation";
import { KETONE_QUAL_LABEL, fmtDateTime, nowLocalInput } from "@/lib/domain/labels";
import type { KetoneQualitative } from "@/lib/domain/types";

export const Route = createFileRoute("/_shell/monitor/cetonas")({
  head: () => ({
    meta: [
      { title: "Cetonas — GlyCare" },
      { name: "description", content: "Registro de cetonas no sangue ou na urina." },
      { property: "og:title", content: "Cetonas — GlyCare" },
      { property: "og:description", content: "Registro de cetonas no sangue ou na urina." },
    ],
  }),
  component: KetonesPage,
});

function KetonesPage() {
  const { readOnly } = usePatientStore();
  const list = useKetones(100);
  const [form, setForm] = useState({ method: "blood" as "blood" | "urine", unit: "mmol/L" as "mmol/L" | "mg/dL" | "qualitative", value: "", qualitative: undefined as KetoneQualitative | undefined, measured_at: nowLocalInput(), notes: "" });
  const [errors, setErrors] = useState<Errors>({});
  const add = useStoreMutation((s, pid, v: KetoneInput) => s.addKetone(pid, v), "Cetona registrada");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = ketoneSchema.safeParse(form);
    if (!r.success) return setErrors(zodErrors(r.error));
    setErrors({});
    add.mutate(r.data, { onSuccess: () => setForm({ ...form, value: "", qualitative: undefined, notes: "", measured_at: nowLocalInput() }) });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Cetonas" subtitle="Sangue (mmol/L) ou urina" />
      {!readOnly && (
        <Card>
          <CardTitle icon={<TestTube className="h-4 w-4" />}>Novo registro</CardTitle>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field id="m" label="Método">
              <Segmented label="Método" value={form.method} onChange={(method) => setForm({ ...form, method, unit: method === "blood" ? "mmol/L" : "qualitative", value: "", qualitative: undefined })} options={[{ value: "blood", label: "Sangue" }, { value: "urine", label: "Urina" }]} />
            </Field>
            {form.method === "urine" && (
              <Field id="u" label="Tipo de resultado" error={errors.unit}>
                <Segmented label="Unidade" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} options={[{ value: "qualitative", label: "Fita (cruzes)" }, { value: "mg/dL", label: "mg/dL" }]} />
              </Field>
            )}
            {form.unit === "qualitative" ? (
              <Field id="q" label="Resultado da fita" error={errors.qualitative}>
                <Segmented label="Resultado" cols={2} value={form.qualitative ?? ("" as KetoneQualitative)} onChange={(qualitative) => setForm({ ...form, qualitative })} options={(Object.keys(KETONE_QUAL_LABEL) as KetoneQualitative[]).map((k) => ({ value: k, label: KETONE_QUAL_LABEL[k] }))} />
              </Field>
            ) : (
              <Field id="v" label={`Valor (${form.unit})`} error={errors.value}>
                <Input id="v" inputMode="decimal" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </Field>
            )}
            <Field id="t" label="Data e horário" error={errors.measured_at}>
              <Input id="t" type="datetime-local" className={inputCls} value={form.measured_at} onChange={(e) => setForm({ ...form, measured_at: e.target.value })} />
            </Field>
            <Field id="n" label="Observações" optional error={errors.notes}>
              <Textarea id="n" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={add.isPending}>Salvar</Button>
          </form>
        </Card>
      )}
      <Notice tone="warning" icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}>
        O GlyCare não interpreta resultados. Em caso de cetonas, siga o plano de cuidados da equipe. <Link to="/config/seguranca" className="font-semibold underline">Ver orientações de segurança</Link>
      </Notice>
      <Card>
        <CardTitle>Histórico</CardTitle>
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} /> : !list.data?.length ? <EmptyState title="Nenhuma cetona registrada" /> : (
          <ul className="divide-y">
            {list.data.map((k) => (
              <li key={k.id} className="flex justify-between gap-2 py-2.5 text-sm">
                <div>
                  <p className="font-bold">{k.unit === "qualitative" && k.qualitative ? KETONE_QUAL_LABEL[k.qualitative] : `${k.value?.toLocaleString("pt-BR")} ${k.unit}`}</p>
                  <p className="text-xs text-muted-foreground">{k.method === "blood" ? "Sangue" : "Urina"} · {fmtDateTime(k.measured_at)}{k.notes ? ` · ${k.notes}` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
