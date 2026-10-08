import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Star, Trash2, History, Utensils, Info } from "lucide-react";
import { PageHeader, Card, CardTitle, EmptyState, ErrorState, LoadingState, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls, selectCls } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useFoods, useGlucose, useMeals, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { computeItem, sumItems } from "@/lib/nutrition";
import { gramsSchema } from "@/lib/validation";
import { FOOD_SOURCE_LABEL, FOOD_STATE_LABEL, MEAL_LABEL, fmtNum, nowLocalInput } from "@/lib/domain/labels";
import type { Food, MealType } from "@/lib/domain/types";
import type { NewMeal } from "@/lib/data/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/alimentacao/")({
  head: () => ({
    meta: [
      { title: "Alimentação — GlyCare" },
      { name: "description", content: "Pesquise alimentos, monte refeições e veja a contagem de carboidratos." },
      { property: "og:title", content: "Alimentação — GlyCare" },
      { property: "og:description", content: "Pesquise alimentos, monte refeições e veja a contagem de carboidratos." },
    ],
  }),
  component: FoodPage,
});

interface Line { key: string; food: Food; grams: string; includesInedible: boolean }

function FoodPage() {
  const { readOnly } = usePatientStore();
  const foods = useFoods();
  const meals = useMeals(50);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [eatenAt, setEatenAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState("");
  const [fav, setFav] = useState(false);
  const [favName, setFavName] = useState("");
  const toggleFav = useStoreMutation((s, _p, v: { id: string; fav: boolean }) => s.toggleFoodFavorite(v.id, v.fav));
  const save = useStoreMutation((s, pid, m: NewMeal) => s.addMeal(pid, m), "Refeição registrada");

  const suggestions = useMemo(() => {
    const all = foods.data ?? [];
    const n = q.trim().toLowerCase();
    const list = n ? all.filter((f) => f.name.toLowerCase().includes(n) || (f.preparation ?? "").toLowerCase().includes(n)) : all.filter((f) => f.is_favorite).concat(all.filter((f) => !f.is_favorite));
    return list.slice(0, 12);
  }, [foods.data, q]);

  const computed = lines.map((l) => {
    const g = gramsSchema.safeParse(l.grams);
    return { line: l, valid: g.success, item: g.success ? computeItem(l.food, g.data, l.includesInedible) : null, error: g.success ? undefined : g.error.issues[0]?.message };
  });
  const totals = sumItems(computed.filter((c) => c.item).map((c) => c.item!));
  const allValid = lines.length > 0 && computed.every((c) => c.valid);
  const favMeals = (meals.data ?? []).filter((m) => m.is_favorite);

  function addFood(f: Food) {
    setLines((ls) => [...ls, { key: crypto.randomUUID(), food: f, grams: "", includesInedible: false }]);
    setQ("");
  }

  function submit() {
    if (!allValid) return;
    save.mutate(
      { meal_type: mealType, eaten_at: new Date(eatenAt).toISOString(), notes: notes.trim() || null, is_favorite: fav, favorite_name: fav ? favName.trim().slice(0, 80) || MEAL_LABEL[mealType] : null, items: computed.map((c) => c.item!), totals },
      { onSuccess: () => { setLines([]); setNotes(""); setFav(false); setFavName(""); setEatenAt(nowLocalInput()); } },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Alimentação" back={false} action={<Button asChild variant="soft" size="sm"><Link to="/alimentacao/historico"><History aria-hidden /> Histórico</Link></Button>} />

      <Notice tone="sim" icon={<Info className="mt-0.5 h-4 w-4 shrink-0" />}>
        A base TACO/TBCA ainda não foi importada. Os alimentos de exemplo têm valores <strong>fictícios</strong> e não devem ser usados para decisões.
      </Notice>

      <Card>
        <CardTitle icon={<Search className="h-4 w-4" />} action={!readOnly && <Button asChild variant="ghost" size="sm"><Link to="/alimentacao/novo"><Plus aria-hidden /> Cadastrar</Link></Button>}>
          Buscar alimento
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" placeholder="Ex.: arroz, feijão…" aria-label="Buscar alimento" className={`${inputCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {foods.isLoading ? <LoadingState /> : foods.error ? <ErrorState error={foods.error} /> : !suggestions.length ? (
          <EmptyState title="Nenhum alimento encontrado">{!readOnly && <Link to="/alimentacao/novo" className="font-semibold text-primary">Cadastrar manualmente</Link>}</EmptyState>
        ) : (
          <ul className="mt-2 divide-y" aria-label="Sugestões">
            {suggestions.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <button className="min-w-0 flex-1 rounded-lg py-1 text-left" onClick={() => addFood(f)} disabled={readOnly}>
                  <p className="truncate font-semibold">{f.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[f.preparation, FOOD_STATE_LABEL[f.state] !== "—" && FOOD_STATE_LABEL[f.state]].filter(Boolean).join(" · ")} · <span className={cn(f.source === "fictional_example" && "font-semibold text-sim")}>{FOOD_SOURCE_LABEL[f.source]}</span> · {fmtNum(f.carbs_per_100g)} g carb/100 g
                  </p>
                </button>
                {f.patient_id && !readOnly && (
                  <button onClick={() => toggleFav.mutate({ id: f.id, fav: !f.is_favorite })} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label={f.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={f.is_favorite}>
                    <Star className={cn("h-5 w-5", f.is_favorite ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
                  </button>
                )}
                {!readOnly && <Button size="icon" variant="soft" onClick={() => addFood(f)} aria-label={`Adicionar ${f.name}`}><Plus aria-hidden /></Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {favMeals.length > 0 && !readOnly && (
        <Card>
          <CardTitle icon={<Star className="h-4 w-4" />}>Refeições favoritas</CardTitle>
          <div className="flex flex-wrap gap-2">
            {favMeals.map((m) => (
              <Button key={m.id} variant="outline" size="sm" onClick={() => {
                const fs = foods.data ?? [];
                setLines(m.items.flatMap((it) => { const f = fs.find((x) => x.id === it.food_id); return f ? [{ key: crypto.randomUUID(), food: f, grams: String(it.grams).replace(".", ","), includesInedible: false }] : []; }));
                setMealType(m.meal_type);
              }}>{m.favorite_name ?? MEAL_LABEL[m.meal_type]}</Button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle icon={<Utensils className="h-4 w-4" />}>Composição da refeição</CardTitle>
        {!lines.length ? <EmptyState title="Nenhum alimento adicionado">Busque e toque em um alimento para adicionar.</EmptyState> : (
          <ul className="space-y-3">
            {computed.map(({ line, item, error }) => (
              <li key={line.key} className="rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{line.food.name}</p>
                    <p className="text-xs text-muted-foreground">{FOOD_SOURCE_LABEL[line.food.source]}{line.food.state !== "not_applicable" && ` · valores para alimento ${FOOD_STATE_LABEL[line.food.state].toLowerCase()}`}</p>
                  </div>
                  <button onClick={() => setLines(lines.filter((l) => l.key !== line.key))} className="flex h-10 w-10 items-center justify-center rounded-full text-destructive hover:bg-danger-soft" aria-label={`Remover ${line.food.name}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input inputMode="decimal" aria-label={`Quantidade em gramas de ${line.food.name}`} placeholder="Gramas" className="h-11 w-28 text-base" value={line.grams} onChange={(e) => setLines(lines.map((l) => (l.key === line.key ? { ...l, grams: e.target.value } : l)))} aria-invalid={!!error && line.grams !== ""} />
                  <span className="text-sm text-muted-foreground">g</span>
                  {item && <span className="ml-auto text-right text-sm font-bold">{fmtNum(item.carbs_g)} g carb</span>}
                </div>
                {error && line.grams !== "" && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
                {line.food.edible_portion_pct < 100 && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <Checkbox checked={line.includesInedible} onCheckedChange={(v) => setLines(lines.map((l) => (l.key === line.key ? { ...l, includesInedible: v === true } : l)))} />
                    Peso inclui partes não comestíveis (parte comestível: {fmtNum(line.food.edible_portion_pct, 0)}%)
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-primary-soft p-3 text-center" aria-live="polite">
          <Total label="Carboidratos" value={totals.carbs_g} unit="g" strong />
          <Total label="Proteínas" value={totals.protein_g} unit="g" />
          <Total label="Gorduras" value={totals.fat_g} unit="g" />
          <Total label="Calorias" value={totals.kcal} unit="kcal" />
        </dl>
        {totals.hasMissing && <p className="mt-2 text-xs text-warning-foreground">“—” indica que algum alimento não possui esse valor na fonte; o total não é estimado.{totals.missingFields.includes("carbs") && " Atenção: carboidratos ausentes em ao menos um item — total parcial."}</p>}

        {!readOnly && lines.length > 0 && (
          <div className="mt-4 space-y-3">
            <Field id="mt" label="Refeição">
              <select id="mt" className={selectCls} value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                {(Object.keys(MEAL_LABEL) as MealType[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field id="et" label="Horário"><Input id="et" type="datetime-local" className={inputCls} value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} /></Field>
            <Field id="nt" label="Observações" optional><Textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={fav} onCheckedChange={(v) => setFav(v === true)} /> Salvar como refeição favorita</label>
            {fav && <Input aria-label="Nome da favorita" placeholder="Nome (ex.: Café padrão)" className={inputCls} value={favName} onChange={(e) => setFavName(e.target.value)} maxLength={80} />}
            <Button size="lg" className="w-full" disabled={!allValid || save.isPending} onClick={submit}>{save.isPending ? "Salvando…" : "Registrar refeição"}</Button>
            <p className="text-center text-xs text-muted-foreground">O GlyCare não sugere doses de insulina com base nos carboidratos.</p>
          </div>
        )}
      </Card>
      <NearbyHint />
    </div>
  );
}

function Total({ label, value, unit, strong }: { label: string; value: number | null; unit: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("font-extrabold", strong ? "text-xl text-primary" : "text-base")}>{value == null ? "—" : fmtNum(value)}<span className="text-xs font-semibold"> {unit}</span></dd>
    </div>
  );
}

function NearbyHint() {
  useGlucose(3); // warms cache for history page
  return null;
}
