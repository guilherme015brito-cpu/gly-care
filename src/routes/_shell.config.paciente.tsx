import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ClipboardList, Target, Phone } from "lucide-react";
import { PageHeader, Card, CardTitle, LoadingState, ErrorState, Notice } from "@/components/glycare/ui-bits";
import { Field, inputCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { settingsSchema, type SettingsInput } from "@/lib/validation";
import type { CarbRatio } from "@/lib/domain/types";

export const Route = createFileRoute("/_shell/config/paciente")({
  head: () => ({
    meta: [
      { title: "Paciente e parâmetros — GlyCare" },
      { name: "description", content: "Parâmetros prescritos pela equipe de saúde." },
      { property: "og:title", content: "Paciente e parâmetros — GlyCare" },
      { property: "og:description", content: "Parâmetros prescritos pela equipe de saúde." },
    ],
  }),
  component: PatientSettings,
});

type FormState = Record<keyof SettingsInput, string>;

function PatientSettings() {
  const { patient, readOnly } = usePatientStore();
  const s = useSettings();
  const [f, setF] = useState<FormState | null>(null);
  const [ratios, setRatios] = useState<CarbRatio[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (s.data && !f) {
      const d = s.data;
      setF({
        nickname: patient.nickname, birth_date: patient.birth_date ?? "", target_glucose_text: d.target_glucose_text ?? "",
        very_low_mgdl: String(d.very_low_mgdl), target_low_mgdl: String(d.target_low_mgdl), target_high_mgdl: String(d.target_high_mgdl), very_high_mgdl: String(d.very_high_mgdl),
        sensitivity_factor_text: d.sensitivity_factor_text ?? "", rapid_insulin_text: d.rapid_insulin_text ?? "", basal_insulin_text: d.basal_insulin_text ?? "",
        administration_times: d.administration_times ?? "", clinical_instructions: d.clinical_instructions ?? "", emergency_contact_name: d.emergency_contact_name ?? "",
        emergency_contact_phone: d.emergency_contact_phone ?? "", last_review_date: d.last_review_date ?? "",
      });
      setRatios(d.carb_ratios);
    }
  }, [s.data, f, patient]);

  const save = useStoreMutation(async (st, pid, v: { data: SettingsInput; ratios: CarbRatio[] }) => {
    const { nickname, birth_date, ...rest } = v.data;
    await st.updatePatient(pid, { nickname, birth_date });
    await st.saveSettings(pid, { ...rest, carb_ratios: v.ratios });
  }, "Parâmetros salvos");

  if (s.isLoading || !f) return <LoadingState />;
  if (s.error) return <ErrorState error={s.error} />;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = settingsSchema.safeParse(f);
    const badRatio = ratios.some((x) => !/^\d{2}:\d{2}$/.test(x.from) || !/^\d{2}:\d{2}$/.test(x.to) || !x.ratio_text.trim() || x.ratio_text.length > 60);
    if (!r.success) return setErrors(zodErrors(r.error));
    if (badRatio) return setErrors({ ratios: "Preencha horário inicial, final e a relação de cada faixa." });
    setErrors({});
    save.mutate({ data: r.data, ratios });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Paciente e parâmetros" />
      <Notice tone="info">
        Estes dados são <strong>prescritos pela equipe de saúde</strong> e apenas armazenados. O GlyCare <strong>não</strong> os usa para calcular ou sugerir doses.
      </Notice>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset disabled={readOnly} className="space-y-4">
          <Card className="space-y-3">
            <CardTitle>Identificação</CardTitle>
            <Field id="nick" label="Nome ou apelido" error={errors["nickname"]}><Input id="nick" className={inputCls} value={f.nickname} onChange={set("nickname")} /></Field>
            <Field id="bd" label="Data de nascimento" optional error={errors["birth_date"]}><Input id="bd" type="date" className={inputCls} value={f.birth_date} onChange={set("birth_date")} /></Field>
          </Card>
          <Card className="space-y-3">
            <CardTitle icon={<Target className="h-4 w-4" />}>Glicemia-alvo e faixas (prescritas)</CardTitle>
            <Field id="tg" label="Glicemia-alvo prescrita" optional hint="Como consta na prescrição" error={errors["target_glucose_text"]}><Input id="tg" className={inputCls} value={f.target_glucose_text} onChange={set("target_glucose_text")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="vl" label="Muito baixa abaixo de" error={errors["very_low_mgdl"]}><Input id="vl" inputMode="numeric" className={inputCls} value={f.very_low_mgdl} onChange={set("very_low_mgdl")} /></Field>
              <Field id="tl" label="Faixa-alvo mínima" error={errors["target_low_mgdl"]}><Input id="tl" inputMode="numeric" className={inputCls} value={f.target_low_mgdl} onChange={set("target_low_mgdl")} /></Field>
              <Field id="th" label="Faixa-alvo máxima" error={errors["target_high_mgdl"]}><Input id="th" inputMode="numeric" className={inputCls} value={f.target_high_mgdl} onChange={set("target_high_mgdl")} /></Field>
              <Field id="vh" label="Muito alta acima de" error={errors["very_high_mgdl"]}><Input id="vh" inputMode="numeric" className={inputCls} value={f.very_high_mgdl} onChange={set("very_high_mgdl")} /></Field>
            </div>
            <p className="text-xs text-muted-foreground">Valores em mg/dL. Os padrões iniciais (54/70/180/250) são apenas ponto de partida: substitua pelos valores da equipe.</p>
          </Card>
          <Card className="space-y-3">
            <CardTitle icon={<ClipboardList className="h-4 w-4" />}>Prescrição</CardTitle>
            <Field id="fs" label="Fator de sensibilidade prescrito" optional error={errors["sensitivity_factor_text"]}><Input id="fs" className={inputCls} value={f.sensitivity_factor_text} onChange={set("sensitivity_factor_text")} /></Field>
            <div>
              <p className="text-sm font-semibold">Relação insulina/carboidrato por horário</p>
              <ul className="mt-2 space-y-2">
                {ratios.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Input type="time" aria-label="Início" className="h-11 w-[5.5rem] px-2" value={r.from} onChange={(e) => setRatios(ratios.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                    <Input type="time" aria-label="Fim" className="h-11 w-[5.5rem] px-2" value={r.to} onChange={(e) => setRatios(ratios.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                    <Input aria-label="Relação" placeholder="1 UI : __ g" className="h-11 flex-1" value={r.ratio_text} onChange={(e) => setRatios(ratios.map((x, j) => (j === i ? { ...x, ratio_text: e.target.value } : x)))} />
                    <button type="button" onClick={() => setRatios(ratios.filter((_, j) => j !== i))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-destructive" aria-label="Remover faixa"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
              {errors["ratios"] && <p role="alert" className="mt-1 text-sm text-destructive">{errors["ratios"]}</p>}
              <Button type="button" variant="soft" size="sm" className="mt-2" onClick={() => setRatios([...ratios, { from: "", to: "", ratio_text: "" }])}><Plus aria-hidden /> Adicionar faixa</Button>
            </div>
            <Field id="ri" label="Insulina rápida" optional error={errors["rapid_insulin_text"]}><Input id="ri" className={inputCls} value={f.rapid_insulin_text} onChange={set("rapid_insulin_text")} /></Field>
            <Field id="bi" label="Insulina basal" optional error={errors["basal_insulin_text"]}><Input id="bi" className={inputCls} value={f.basal_insulin_text} onChange={set("basal_insulin_text")} /></Field>
            <Field id="at" label="Horários de administração" optional error={errors["administration_times"]}><Input id="at" className={inputCls} value={f.administration_times} onChange={set("administration_times")} /></Field>
            <Field id="ci" label="Instruções clínicas da equipe" optional hint="Transcreva exatamente como fornecido pela equipe" error={errors["clinical_instructions"]}><Textarea id="ci" rows={5} value={f.clinical_instructions} onChange={set("clinical_instructions")} maxLength={4000} /></Field>
            <Field id="lr" label="Data da última revisão dos parâmetros" optional error={errors["last_review_date"]}><Input id="lr" type="date" className={inputCls} value={f.last_review_date} onChange={set("last_review_date")} /></Field>
          </Card>
          <Card className="space-y-3">
            <CardTitle icon={<Phone className="h-4 w-4" />}>Contato de emergência</CardTitle>
            <Field id="en" label="Nome" optional error={errors["emergency_contact_name"]}><Input id="en" className={inputCls} value={f.emergency_contact_name} onChange={set("emergency_contact_name")} /></Field>
            <Field id="ep" label="Telefone" optional error={errors["emergency_contact_phone"]}><Input id="ep" type="tel" className={inputCls} value={f.emergency_contact_phone} onChange={set("emergency_contact_phone")} /></Field>
          </Card>
        </fieldset>
        {!readOnly && <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar parâmetros"}</Button>}
      </form>
    </div>
  );
}
