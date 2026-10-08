import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Syringe, BookOpen } from "lucide-react";
import { PageHeader, Card, CardTitle, EmptyState, ErrorState, LoadingState, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, selectCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActionProfiles, useCatalog, usePatientInsulins, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { insulinCatalogSchema, type InsulinCatalogInput } from "@/lib/validation";
import { VALIDATION_LABEL } from "@/lib/domain/labels";
import type { PatientInsulin, ValidationStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/config/insulinas")({
  head: () => ({
    meta: [
      { title: "Insulinas — GlyCare" },
      { name: "description", content: "Catálogo de insulinas e insulinas em uso pela paciente." },
      { property: "og:title", content: "Insulinas — GlyCare" },
      { property: "og:description", content: "Catálogo de insulinas e insulinas em uso pela paciente." },
    ],
  }),
  component: InsulinsPage,
});

const EMPTY = { brand_name: "", active_ingredient: "", manufacturer: "", pharmacological_class: "", concentration: "", route: "", presentation: "", onset_text: "", peak_text: "", effective_duration_text: "", max_duration_text: "", source_reference: "", source_review_date: "", validation_status: "not_validated" as ValidationStatus };

function InsulinsPage() {
  const { readOnly } = usePatientStore();
  const [tab, setTab] = useState<"use" | "catalog">("use");
  return (
    <div className="space-y-4">
      <PageHeader title="Insulinas" />
      <Segmented label="Seção" value={tab} onChange={setTab} options={[{ value: "use", label: "Em uso" }, { value: "catalog", label: "Catálogo" }]} />
      {tab === "use" ? <InUse readOnly={readOnly} /> : <Catalog readOnly={readOnly} />}
    </div>
  );
}

function InUse({ readOnly }: { readOnly: boolean }) {
  const catalog = useCatalog();
  const pis = usePatientInsulins();
  const [f, setF] = useState({ insulin_id: "", role: "rapid" as PatientInsulin["role"], prescribed_dose_text: "", prescribed_times: "", notes: "", started_on: "" });
  const [err, setErr] = useState("");
  const add = useStoreMutation((s, pid, v: typeof f) => s.addPatientInsulin(pid, { insulin_id: v.insulin_id, role: v.role, prescribed_dose_text: v.prescribed_dose_text.trim().slice(0, 200) || null, prescribed_times: v.prescribed_times.trim().slice(0, 200) || null, notes: v.notes.trim().slice(0, 1000) || null, started_on: v.started_on || null }), "Insulina adicionada ao tratamento");
  const end = useStoreMutation((s, _p, id: string) => s.endPatientInsulin(id, new Date().toISOString().slice(0, 10)), "Insulina encerrada (histórico preservado)");
  const name = (id: string) => catalog.data?.find((c) => c.id === id)?.brand_name ?? "—";
  const ROLE = { rapid: "Rápida/ultrarrápida", basal: "Basal", other: "Outra" };

  return (
    <>
      <Card>
        <CardTitle icon={<Syringe className="h-4 w-4" />}>Tratamento atual e anterior</CardTitle>
        {pis.isLoading ? <LoadingState /> : pis.error ? <ErrorState error={pis.error} /> : !pis.data?.length ? <EmptyState title="Nenhuma insulina em uso cadastrada" /> : (
          <ul className="divide-y">
            {pis.data.map((p) => (
              <li key={p.id} className={cn("py-3", !p.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{name(p.insulin_id)}</p>
                    <p className="text-sm text-muted-foreground">{ROLE[p.role]} · Dose prescrita: {p.prescribed_dose_text ?? "não informada"} · Horários: {p.prescribed_times ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.active ? "Em uso" : `Encerrada em ${p.ended_on}`}{p.started_on && ` · início ${p.started_on}`}</p>
                  </div>
                  {p.active && !readOnly && <Button variant="ghost" size="sm" onClick={() => confirm("Encerrar esta insulina no tratamento? O histórico será mantido.") && end.mutate(p.id)}>Encerrar</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!readOnly && (
        <Card className="space-y-3">
          <CardTitle icon={<Plus className="h-4 w-4" />}>Adicionar ao tratamento</CardTitle>
          <Field id="pi" label="Insulina (do catálogo)" error={err}>
            <select id="pi" className={selectCls} value={f.insulin_id} onChange={(e) => setF({ ...f, insulin_id: e.target.value })}>
              <option value="">Selecione…</option>
              {catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.brand_name}{c.concentration ? ` (${c.concentration})` : ""}</option>)}
            </select>
          </Field>
          <Segmented label="Uso" value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ value: "rapid", label: "Rápida" }, { value: "basal", label: "Basal" }, { value: "other", label: "Outra" }]} />
          <Field id="pd" label="Dose prescrita" optional hint="Como consta na prescrição"><Input id="pd" className={inputCls} value={f.prescribed_dose_text} onChange={(e) => setF({ ...f, prescribed_dose_text: e.target.value })} /></Field>
          <Field id="pt" label="Horários prescritos" optional><Input id="pt" className={inputCls} value={f.prescribed_times} onChange={(e) => setF({ ...f, prescribed_times: e.target.value })} /></Field>
          <Field id="ps" label="Início" optional><Input id="ps" type="date" className={inputCls} value={f.started_on} onChange={(e) => setF({ ...f, started_on: e.target.value })} /></Field>
          <Button size="lg" className="w-full" disabled={add.isPending} onClick={() => { if (!f.insulin_id) return setErr("Selecione a insulina"); setErr(""); add.mutate(f, { onSuccess: () => setF({ ...f, insulin_id: "", prescribed_dose_text: "", prescribed_times: "", started_on: "" }) }); }}>Adicionar</Button>
        </Card>
      )}
    </>
  );
}

function Catalog({ readOnly }: { readOnly: boolean }) {
  const catalog = useCatalog();
  const profiles = useActionProfiles();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const add = useStoreMutation((s, _p, v: InsulinCatalogInput) => s.addCatalogInsulin(v), "Insulina cadastrada no catálogo");
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = insulinCatalogSchema.safeParse(f);
    if (!r.success) return setErrors(zodErrors(r.error));
    setErrors({});
    add.mutate(r.data, { onSuccess: () => { setF(EMPTY); setOpen(false); } });
  }

  return (
    <>
      <Notice tone="warning">
        Preencha dados farmacológicos somente a partir da bula ou fonte científica oficial da <strong>marca e apresentação exatas</strong>. Duração de ação não é meia-vida plasmática. Campos aceitam intervalos e texto (ex.: “2 a 4 h, varia com dose”).
      </Notice>
      {!readOnly && !open && <Button size="lg" variant="soft" className="w-full" onClick={() => setOpen(true)}><Plus aria-hidden /> Cadastrar insulina no catálogo</Button>}
      {open && (
        <Card>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field id="bn" label="Nome comercial" error={errors["brand_name"]}><Input id="bn" className={inputCls} value={f.brand_name} onChange={set("brand_name")} /></Field>
            <Field id="ai" label="Princípio ativo" optional><Input id="ai" className={inputCls} value={f.active_ingredient} onChange={set("active_ingredient")} /></Field>
            <Field id="mf" label="Fabricante" optional><Input id="mf" className={inputCls} value={f.manufacturer} onChange={set("manufacturer")} /></Field>
            <Field id="pc" label="Classe farmacológica" optional><Input id="pc" className={inputCls} value={f.pharmacological_class} onChange={set("pharmacological_class")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="cc" label="Concentração" optional><Input id="cc" placeholder="U-100" className={inputCls} value={f.concentration} onChange={set("concentration")} /></Field>
              <Field id="rt" label="Via" optional><Input id="rt" placeholder="Subcutânea" className={inputCls} value={f.route} onChange={set("route")} /></Field>
            </div>
            <Field id="pr" label="Apresentação" optional><Input id="pr" placeholder="Caneta, frasco…" className={inputCls} value={f.presentation} onChange={set("presentation")} /></Field>
            <p className="pt-2 text-sm font-bold">Perfil de ação (deixe vazio se desconhecido)</p>
            <Field id="on" label="Início de ação" optional><Textarea id="on" rows={2} value={f.onset_text} onChange={set("onset_text")} /></Field>
            <Field id="pk" label="Pico de ação" optional><Textarea id="pk" rows={2} value={f.peak_text} onChange={set("peak_text")} /></Field>
            <Field id="ed" label="Duração efetiva" optional><Textarea id="ed" rows={2} value={f.effective_duration_text} onChange={set("effective_duration_text")} /></Field>
            <Field id="md" label="Duração máxima" optional><Textarea id="md" rows={2} value={f.max_duration_text} onChange={set("max_duration_text")} /></Field>
            <Field id="sr" label="Fonte farmacológica" optional hint="Bula, artigo, versão"><Input id="sr" className={inputCls} value={f.source_reference} onChange={set("source_reference")} /></Field>
            <Field id="sd" label="Data da revisão da fonte" optional><Input id="sd" type="date" className={inputCls} value={f.source_review_date} onChange={set("source_review_date")} /></Field>
            <Field id="vs" label="Status de validação científica">
              <select id="vs" className={selectCls} value={f.validation_status} onChange={(e) => setF({ ...f, validation_status: e.target.value as ValidationStatus })}>
                {(Object.keys(VALIDATION_LABEL) as ValidationStatus[]).map((k) => <option key={k} value={k}>{VALIDATION_LABEL[k]}</option>)}
              </select>
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={add.isPending}>Salvar</Button>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <CardTitle icon={<BookOpen className="h-4 w-4" />}>Catálogo</CardTitle>
        {catalog.isLoading ? <LoadingState /> : catalog.error ? <ErrorState error={catalog.error} /> : !catalog.data?.length ? <EmptyState title="Catálogo vazio">Cadastre as insulinas usadas pela paciente.</EmptyState> : (
          <ul className="space-y-3">
            {catalog.data.map((c) => {
              const p = profiles.data?.find((x) => x.insulin_id === c.id);
              return (
                <li key={c.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{c.brand_name}</p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", p?.validation_status === "validated" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground")}>{VALIDATION_LABEL[p?.validation_status ?? "not_validated"]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{[c.active_ingredient, c.manufacturer, c.pharmacological_class, c.concentration, c.route, c.presentation].filter(Boolean).join(" · ") || "Dados não informados"}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Início</dt><dd>{p?.onset_text ?? "Desconhecido"}</dd>
                    <dt className="text-muted-foreground">Pico</dt><dd>{p?.peak_text ?? "Desconhecido"}</dd>
                    <dt className="text-muted-foreground">Duração efetiva</dt><dd>{p?.effective_duration_text ?? "Desconhecida"}</dd>
                    <dt className="text-muted-foreground">Duração máxima</dt><dd>{p?.max_duration_text ?? "Desconhecida"}</dd>
                    <dt className="text-muted-foreground">Fonte</dt><dd>{p?.source_reference ?? "—"}{p?.source_review_date ? ` (${p.source_review_date})` : ""}</dd>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
