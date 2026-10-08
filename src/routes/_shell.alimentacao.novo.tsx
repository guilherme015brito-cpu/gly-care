import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, zodErrors, type Errors } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { foodSchema, type FoodInput } from "@/lib/validation";

export const Route = createFileRoute("/_shell/alimentacao/novo")({
  head: () => ({
    meta: [
      { title: "Cadastrar alimento — GlyCare" },
      { name: "description", content: "Cadastro manual de alimento ou receita caseira." },
      { property: "og:title", content: "Cadastrar alimento — GlyCare" },
      { property: "og:description", content: "Cadastro manual de alimento ou receita caseira." },
    ],
  }),
  component: NewFood,
});

function NewFood() {
  const { readOnly } = usePatientStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", preparation: "", state: "not_applicable" as FoodInput["state"], source: "manual" as FoodInput["source"], source_reference: "", carbs_per_100g: "", protein_per_100g: "", fat_per_100g: "", kcal_per_100g: "", edible_portion_pct: "100" });
  const [errors, setErrors] = useState<Errors>({});
  const save = useStoreMutation((s, pid, v: FoodInput) => s.addFood(pid, v), "Alimento cadastrado");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = foodSchema.safeParse(f);
    if (!r.success) return setErrors(zodErrors(r.error));
    setErrors({});
    save.mutate(r.data, { onSuccess: () => navigate({ to: "/alimentacao" }) });
  }
  if (readOnly) return <Notice>Acesso somente leitura.</Notice>;

  return (
    <div className="space-y-4">
      <PageHeader title="Cadastrar alimento" subtitle="Valores por 100 g" />
      <Card>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Segmented label="Tipo" value={f.source} onChange={(source) => setF({ ...f, source })} options={[{ value: "manual", label: "Alimento" }, { value: "recipe", label: "Receita caseira" }]} />
          <Field id="n" label="Nome" error={errors["name"]}><Input id="n" className={inputCls} value={f.name} onChange={set("name")} maxLength={160} /></Field>
          <Field id="p" label="Tipo de preparo" optional error={errors["preparation"]}><Input id="p" className={inputCls} placeholder="Ex.: cozido, assado" value={f.preparation} onChange={set("preparation")} /></Field>
          <Field id="s" label="Valores referem-se ao alimento">
            <Segmented label="Estado" value={f.state} onChange={(state) => setF({ ...f, state })} options={[{ value: "raw", label: "Cru" }, { value: "cooked", label: "Cozido" }, { value: "not_applicable", label: "N/A" }]} />
          </Field>
          <Field id="r" label="Fonte dos valores" optional hint="Ex.: rótulo do produto, nutricionista" error={errors["source_reference"]}><Input id="r" className={inputCls} value={f.source_reference} onChange={set("source_reference")} /></Field>
          <Notice tone="info">Deixe em branco o que você não sabe. O app não inventa valores ausentes.</Notice>
          <div className="grid grid-cols-2 gap-3">
            <Field id="c" label="Carboidratos (g)" error={errors["carbs_per_100g"]}><Input id="c" inputMode="decimal" className={inputCls} value={f.carbs_per_100g} onChange={set("carbs_per_100g")} /></Field>
            <Field id="pr" label="Proteínas (g)" error={errors["protein_per_100g"]}><Input id="pr" inputMode="decimal" className={inputCls} value={f.protein_per_100g} onChange={set("protein_per_100g")} /></Field>
            <Field id="fa" label="Gorduras (g)" error={errors["fat_per_100g"]}><Input id="fa" inputMode="decimal" className={inputCls} value={f.fat_per_100g} onChange={set("fat_per_100g")} /></Field>
            <Field id="k" label="Calorias (kcal)" error={errors["kcal_per_100g"]}><Input id="k" inputMode="decimal" className={inputCls} value={f.kcal_per_100g} onChange={set("kcal_per_100g")} /></Field>
          </div>
          <Field id="e" label="Parte comestível (%)" hint="100% se não houver casca, caroço ou osso" error={errors["edible_portion_pct"]}><Input id="e" inputMode="decimal" className={inputCls} value={f.edible_portion_pct} onChange={set("edible_portion_pct")} /></Field>
          <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>Salvar alimento</Button>
        </form>
      </Card>
    </div>
  );
}
