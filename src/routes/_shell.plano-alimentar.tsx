import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus, Save, Trash2, Clock3, Search } from "lucide-react";
import { usePatientStore } from "@/lib/app-context";
import { useFoods, useSettings, useStoreMutation } from "@/hooks/use-data";
import {
  mealPlanSchema,
  plannedMealTotals,
  plannedMealCoverage,
  type MealPlan,
  type MealPlanInput,
  type PlannedMeal,
} from "@/lib/meal-plans";
import type { Food, MealType } from "@/lib/domain/types";
import { foodMeasures } from "@/lib/food-measures";
import { MEAL_LABEL, fmtNum } from "@/lib/domain/labels";
import {
  PageHeader,
  Card,
  CardTitle,
  Notice,
  ErrorState,
  LoadingState,
  EmptyState,
} from "@/components/glycare/ui-bits";
import { Field, inputCls, selectCls } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_shell/plano-alimentar")({
  head: () => ({ meta: [{ title: "Plano alimentar — GlyCare" }] }),
  component: PlanPage,
});
const blank = (): MealPlanInput => ({ name: "", meals: [] });
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
function PlanPage() {
  const { key } = usePatientStore();
  return <PlanEditor key={key.join(":")} />;
}
export function PlanEditor() {
  const { store, pid, key, readOnly, mode } = usePatientStore();
  const plans = useQuery({
    queryKey: [...key, "meal-plans"],
    queryFn: () => store.listMealPlans(pid),
  });
  const foods = useFoods(),
    settings = useSettings();
  const [draft, setDraft] = useState<MealPlanInput>(blank);
  const [identity, setIdentity] = useState<{ id: string; version: number }>({
    id: crypto.randomUUID(),
    version: 0,
  });
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [switchTo, setSwitchTo] = useState<MealPlan | "new" | null>(null);
  const [removing, setRemoving] = useState(false);
  const save = useStoreMutation(
    (s, p, v: { input: MealPlanInput; id: string; version: number }) =>
      s.saveMealPlan(p, v.input, v.id, v.version),
    "Plano alimentar salvo",
  );
  const remove = useStoreMutation(
    (s, p, v: { id: string; version: number }) => s.deleteMealPlan(p, v.id, v.version),
    "Cardápio excluído",
  );
  const busy = save.isPending || remove.isPending;
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });
  useEffect(() => {
    if (!initialized && plans.data) {
      setInitialized(true);
      const first = plans.data[0];
      if (first && !dirty) load(first);
    }
  }, [plans.data, initialized, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function change(next: MealPlanInput) {
    setDraft(next);
    setDirty(true);
    setError("");
  }
  function load(plan: MealPlan | "new") {
    setInitialized(true);
    setDraft(plan === "new" ? blank() : structuredClone({ name: plan.name, meals: plan.meals }));
    setIdentity(
      plan === "new"
        ? { id: crypto.randomUUID(), version: 0 }
        : { id: plan.id, version: plan.version },
    );
    setDirty(false);
    setError("");
    setSwitchTo(null);
  }
  function select(plan: MealPlan | "new") {
    if (dirty) setSwitchTo(plan);
    else load(plan);
  }
  function submit() {
    const parsed = mealPlanSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise o plano.");
      return;
    }
    save.mutate({ input: parsed.data, ...identity }, { onSuccess: (row) => load(row as MealPlan) });
  }
  const ordered = [...draft.meals].sort((a, b) => a.time.localeCompare(b.time));
  const summaries = draft.meals.map((m) => ({
    totals: plannedMealTotals(m),
    dose: plannedMealCoverage(m, settings.error ? undefined : settings.data),
  }));
  const carbs =
    summaries.length && summaries.every((s) => s.totals.carbs_g != null)
      ? summaries.reduce((n, s) => n + s.totals.carbs_g!, 0)
      : null;
  function updateMeal(meal: PlannedMeal) {
    change({ ...draft, meals: draft.meals.map((m) => (m.id === meal.id ? meal : m)) });
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Plano alimentar"
        subtitle="Organize seus cardápios, horários e porções"
        back={false}
        action={
          !readOnly && (
            <Button variant="soft" size="sm" disabled={busy} onClick={() => select("new")}>
              <Plus aria-hidden /> Novo
            </Button>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <CardTitle icon={<CalendarDays size={18} />}>Meus cardápios</CardTitle>
            {plans.isLoading ? (
              <LoadingState />
            ) : plans.error ? (
              <ErrorState error={plans.error} />
            ) : !plans.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro cardápio para começar.
              </p>
            ) : (
              <nav aria-label="Cardápios" className="space-y-2">
                {plans.data.map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => select(p)}
                    aria-pressed={p.id === identity.id}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${p.id === identity.id ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"}`}
                  >
                    <strong className="block break-words">{p.name}</strong>
                    <span className="text-xs">{p.meals.length} refeições</span>
                  </button>
                ))}
              </nav>
            )}
          </Card>
          <Card className="space-y-2">
            <p className="text-sm text-muted-foreground">Carboidratos selecionados no cardápio</p>
            <p className="text-3xl font-bold text-primary">
              {fmtNum(carbs)} <span className="text-base">g</span>
            </p>
            <p className="text-xs text-muted-foreground">
              A cobertura em UI aparece separada em cada refeição.
            </p>
          </Card>
        </aside>
        <div className="min-w-0 space-y-4">
          <Card className="space-y-4">
            <Field id="plan-name" label="Nome do cardápio">
              <Input
                id="plan-name"
                placeholder="Ex.: Cardápio da semana"
                className={inputCls}
                maxLength={100}
                value={draft.name}
                disabled={readOnly || busy}
                onChange={(e) => change({ ...draft, name: e.target.value })}
              />
            </Field>
            <p className="text-sm text-muted-foreground">
              Selecione os alimentos que compõem cada refeição. Quantidades e horários podem ser
              alterados a qualquer momento.
            </p>
            <Notice>
              {mode === "demo" ? "Demonstração com parâmetros fictícios. " : ""}UI estimadas apenas
              para os carboidratos selecionados, usando a relação configurada para a refeição ou
              horário. Não incluem correção de glicemia nem insulina em ação. Confirme o plano com
              sua equipe de cuidado.
            </Notice>
            <Link to="/config/paciente" className="inline-block text-sm font-semibold text-primary">
              Editar relações de carboidratos nas configurações
            </Link>
            {settings.error && <ErrorState error={settings.error} />}
          </Card>
          {!ordered.length && (
            <EmptyState title="Monte seu planejamento">
              Adicione uma refeição, defina seu horário e escolha os alimentos.
            </EmptyState>
          )}
          {ordered.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              foods={foods.data ?? []}
              settings={settings.error ? undefined : settings.data}
              disabled={readOnly || busy}
              onChange={updateMeal}
              onRemove={() =>
                change({ ...draft, meals: draft.meals.filter((m) => m.id !== meal.id) })
              }
            />
          ))}
          {foods.error && <ErrorState error={foods.error} />}
          {!readOnly && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || draft.meals.length >= 24}
                  onClick={() =>
                    change({
                      ...draft,
                      meals: [
                        ...draft.meals,
                        {
                          id: crypto.randomUUID(),
                          name: "Nova refeição",
                          time: "12:00",
                          meal_type: "lunch",
                          items: [],
                        },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden /> Adicionar refeição
                </Button>
                <Button disabled={busy || !dirty} onClick={submit}>
                  <Save aria-hidden />
                  {save.isPending ? "Salvando…" : "Salvar cardápio"}
                </Button>
                {identity.version > 0 && (
                  <Button variant="ghost" disabled={busy} onClick={() => setRemoving(true)}>
                    <Trash2 aria-hidden /> Excluir cardápio
                  </Button>
                )}
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {dirty
                  ? "Alterações não salvas. Salve o cardápio antes de sair."
                  : identity.version > 0
                    ? "Cardápio salvo."
                    : "Novo cardápio."}
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {save.error && <ErrorState error={save.error} />}
            </div>
          )}
        </div>
      </div>
      <Dialog open={!!switchTo} onOpenChange={(o) => !o && setSwitchTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>Há alterações ainda não salvas neste cardápio.</DialogDescription>
          </DialogHeader>
          <Button onClick={() => switchTo && load(switchTo)}>Descartar e continuar</Button>
          <Button variant="outline" onClick={() => setSwitchTo(null)}>
            Continuar editando
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={removing} onOpenChange={(o) => !busy && setRemoving(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cardápio?</DialogTitle>
            <DialogDescription>
              O planejamento será excluído. Refeições já registradas permanecem no histórico.
            </DialogDescription>
          </DialogHeader>
          {remove.error && <ErrorState error={remove.error} />}
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              remove.mutate(identity, {
                onSuccess: () => {
                  setRemoving(false);
                  load("new");
                },
              })
            }
          >
            Excluir cardápio
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setRemoving(false)}>
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={blocker.status === "blocked"} onOpenChange={(o) => !o && blocker.reset?.()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              As alterações deste cardápio ainda não foram salvas.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => blocker.proceed?.()}>Sair sem salvar</Button>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            Continuar editando
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MealCard({
  meal,
  foods,
  settings,
  disabled,
  onChange,
  onRemove,
}: {
  meal: PlannedMeal;
  foods: Food[];
  settings: Parameters<typeof plannedMealCoverage>[1];
  disabled: boolean;
  onChange: (meal: PlannedMeal) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const suggestions = query.trim()
    ? foods.filter((f) => normalize(f.name).includes(normalize(query))).slice(0, 8)
    : [];
  const totals = plannedMealTotals(meal),
    coverage = plannedMealCoverage(meal, settings);
  return (
    <Card className="space-y-4" aria-label={meal.name}>
      <div className="flex items-center gap-2">
        <Clock3 className="text-primary" size={19} />
        <h2 className="flex-1 font-bold">
          {meal.time} · {meal.name}
        </h2>
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover refeição ${meal.name}`}
            onClick={onRemove}
          >
            <Trash2 size={17} />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
        <Field id={`name-${meal.id}`} label="Nome da refeição">
          <Input
            id={`name-${meal.id}`}
            value={meal.name}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => onChange({ ...meal, name: e.target.value })}
          />
        </Field>
        <Field id={`time-${meal.id}`} label="Horário">
          <Input
            id={`time-${meal.id}`}
            type="time"
            value={meal.time}
            disabled={disabled}
            onChange={(e) => onChange({ ...meal, time: e.target.value })}
          />
        </Field>
        <Field id={`type-${meal.id}`} label="Tipo de refeição">
          <select
            id={`type-${meal.id}`}
            className={selectCls}
            value={meal.meal_type}
            disabled={disabled}
            onChange={(e) => onChange({ ...meal, meal_type: e.target.value as MealType })}
          >
            {Object.entries(MEAL_LABEL).map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ul className="divide-y">
        {meal.items.map((item) => (
          <li key={item.id} className="space-y-2 py-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-primary"
                checked={item.selected}
                disabled={disabled}
                aria-label={`Incluir ${item.food.name}`}
                onChange={(e) =>
                  onChange({
                    ...meal,
                    items: meal.items.map((i) =>
                      i.id === item.id ? { ...i, selected: e.target.checked } : i,
                    ),
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{item.food.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.food.source} · {fmtNum(item.food.carbs_per_100g)} g de carboidratos / 100 g
                </p>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${item.food.name}`}
                  onClick={() =>
                    onChange({ ...meal, items: meal.items.filter((i) => i.id !== item.id) })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 pl-8">
              <Field id={`qty-${item.id}`} label="Quantidade">
                <Input
                  id={`qty-${item.id}`}
                  inputMode="decimal"
                  value={item.quantity}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...meal,
                      items: meal.items.map((i) =>
                        i.id === item.id ? { ...i, quantity: e.target.value } : i,
                      ),
                    })
                  }
                />
              </Field>
              <Field id={`measure-${item.id}`} label="Medida">
                <select
                  id={`measure-${item.id}`}
                  className={selectCls}
                  value={item.measure}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...meal,
                      items: meal.items.map((i) =>
                        i.id === item.id ? { ...i, measure: e.target.value, quantity: "1" } : i,
                      ),
                    })
                  }
                >
                  {foodMeasures(item.food).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="space-y-2">
          <Field id={`search-${meal.id}`} label="Adicionar alimento">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
              <Input
                id={`search-${meal.id}`}
                className="pl-9"
                placeholder="Busque arroz, feijão, fruta…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
          {suggestions.length > 0 ? (
            <ul className="divide-y rounded-xl border">
              {suggestions.map((f) => (
                <li key={f.id}>
                  <button
                    disabled={meal.items.length >= 50}
                    className="w-full p-3 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      onChange({
                        ...meal,
                        items: [
                          ...meal.items,
                          {
                            id: crypto.randomUUID(),
                            food: f,
                            quantity: f.portion_grams ? "1" : "100",
                            measure: f.portion_grams ? "portion" : "g",
                            selected: true,
                          },
                        ],
                      });
                      setQuery("");
                    }}
                  >
                    {f.name}
                    <span className="ml-2 text-xs text-muted-foreground">{f.source}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="text-sm text-muted-foreground">Nenhum alimento encontrado.</p>
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-primary-soft p-4" aria-live="polite">
        <div>
          <p className="text-xs text-muted-foreground">Carboidratos selecionados</p>
          <p className="text-2xl font-bold">
            {fmtNum(totals.carbs_g)} <span className="text-sm">g</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cobertura estimada da refeição</p>
          <p className="text-2xl font-bold text-primary">
            {fmtNum(coverage.units, 2)} <span className="text-sm">UI</span>
          </p>
        </div>
      </div>
      {coverage.message ? (
        <p className="text-sm text-warning-foreground">{coverage.message}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {fmtNum(totals.carbs_g)} g ÷ {fmtNum(coverage.ratio)} g/UI. Resultado exibido com duas
          casas decimais; sem arredondamento para dispositivo de aplicação.
        </p>
      )}
    </Card>
  );
}
