import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Star,
  Trash2,
  History,
  Utensils,
  Info,
  Check,
  Clock3,
  Syringe,
} from "lucide-react";
import {
  PageHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
} from "@/components/glycare/ui-bits";
import { Field, inputCls, selectCls } from "@/components/glycare/form";
import { DemoMealDoseCalculator } from "@/components/glycare/DemoDoseCalculator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useFoods,
  useMeals,
  useCatalog,
  usePatientInsulins,
  useStoreMutation,
} from "@/hooks/use-data";
import { useDemoMealDose } from "@/hooks/use-demo-meal-dose";
import { usePatientStore } from "@/lib/app-context";
import { computeItem, sumItems } from "@/lib/nutrition";
import { administrationSchema, decimalString, gramsSchema } from "@/lib/validation";
import {
  FOOD_SOURCE_LABEL,
  FOOD_STATE_LABEL,
  MEAL_LABEL,
  fmtNum,
  nowLocalInput,
  fmtDateTime,
} from "@/lib/domain/labels";
import type { Food, MealType } from "@/lib/domain/types";
import type { NewMeal } from "@/lib/data/store";
import type { AdministrationInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/alimentacao/")({
  head: () => ({
    meta: [
      { title: "Alimentação — GlyCare" },
      {
        name: "description",
        content: "Pesquise alimentos, monte refeições e veja a contagem de carboidratos.",
      },
      { property: "og:title", content: "Alimentação — GlyCare" },
      {
        property: "og:description",
        content: "Pesquise alimentos, monte refeições e veja a contagem de carboidratos.",
      },
    ],
  }),
  component: FoodPage,
});

interface Line {
  key: string;
  food: Food;
  grams: string;
  includesInedible: boolean;
}

// Remove accent marks and normalize punctuation/spacing, preserving source food labels.
function normalizeFoodSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function FoodPage() {
  const { readOnly, mode } = usePatientStore();
  const foods = useFoods();
  const meals = useMeals(50);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [eatenAt, setEatenAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState("");
  const [fav, setFav] = useState(false);
  const [favName, setFavName] = useState("");
  const catalog = useCatalog();
  const patientInsulins = usePatientInsulins();
  const [pending, setPending] = useState<{
    meal: NewMeal;
    dose: number;
    glucose: number | null;
    purpose: "meal" | "combined";
    requestId: string;
  } | null>(null);
  const [insulinId, setInsulinId] = useState("");
  const [manualDose, setManualDose] = useState("");
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState(nowLocalInput());
  const [registered, setRegistered] = useState<"performed" | "planned" | "meal" | null>(null);
  const submitting = useRef(false);
  const toggleFav = useStoreMutation((s, _p, v: { id: string; fav: boolean }) =>
    s.toggleFoodFavorite(v.id, v.fav),
  );
  const save = useStoreMutation((s, pid, m: NewMeal) => {
    if (m.items.some((item) => item.carbs_g == null))
      throw new Error("Total de carboidratos incompleto. A refeição não foi registrada.");
    return s.addMeal(pid, m);
  }, "Refeição registrada");
  const saveTogether = useStoreMutation(
    (s, pid, v: { meal: NewMeal; administration: AdministrationInput; requestId: string }) =>
      s.addMealWithAdministration(pid, v.meal, v.administration, v.requestId),
  );

  const suggestions = useMemo(() => {
    const all = foods.data ?? [];
    const n = normalizeFoodSearch(q);
    if (!n) return [];
    const list = all.filter(
      (f) =>
        normalizeFoodSearch(f.name).includes(n) ||
        normalizeFoodSearch(f.preparation ?? "").includes(n),
    );
    return list.slice(0, 8);
  }, [foods.data, q]);

  const computed = lines.map((l) => {
    const g = gramsSchema.safeParse(l.grams);
    return {
      line: l,
      valid: g.success,
      item: g.success ? computeItem(l.food, g.data, l.includesInedible) : null,
      error: g.success ? undefined : g.error.issues[0]?.message,
    };
  });
  const totals = sumItems(computed.filter((c) => c.item).map((c) => c.item!));
  const allValid = lines.length > 0 && computed.every((c) => c.valid);
  const dose = useDemoMealDose(
    totals.carbs_g,
    eatenAt,
    allValid && totals.carbs_g != null,
    mealType,
  );
  const rapidOptions = (patientInsulins.data ?? [])
    .filter((p) => p.active && p.role === "rapid")
    .flatMap((p) => {
      const c = catalog.data?.find((c) => c.id === p.insulin_id);
      return c ? [c] : [];
    });
  const favMeals = (meals.data ?? []).filter((m) => m.is_favorite);

  function addFood(f: Food) {
    setLines((ls) => [
      ...ls,
      { key: crypto.randomUUID(), food: f, grams: "", includesInedible: false },
    ]);
    setQ("");
  }

  function clearMeal() {
    setLines([]);
    setNotes("");
    setFav(false);
    setFavName("");
    setEatenAt(nowLocalInput());
    setPending(null);
  }

  function submit() {
    if (
      readOnly ||
      !allValid ||
      totals.carbs_g == null ||
      submitting.current ||
      pending ||
      !Number.isFinite(new Date(eatenAt).getTime())
    )
      return;
    const meal: NewMeal = {
      meal_type: mealType,
      eaten_at: new Date(eatenAt).toISOString(),
      notes: notes.trim() || null,
      is_favorite: fav,
      favorite_name: fav ? favName.trim().slice(0, 80) || MEAL_LABEL[mealType] : null,
      items: computed.map((c) => c.item!),
      totals: { ...totals, carbs_g: totals.carbs_g },
    };
    if (mode === "cloud" || (dose.result && dose.reading && dose.result.rounded > 0)) {
      setInsulinId(rapidOptions[0]?.id ?? "");
      setManualDose("");
      setConfirmationError(null);
      setAppliedAt(nowLocalInput());
      setPending({
        meal,
        requestId: crypto.randomUUID(),
        dose: mode === "demo" ? dose.result!.rounded : 0,
        glucose: mode === "demo" ? dose.reading!.value_mgdl : null,
        purpose: mode === "demo" && dose.result!.correction > 0 ? "combined" : "meal",
      });
      return;
    }
    submitting.current = true;
    save.mutate(meal, {
      onSuccess: () => {
        clearMeal();
        setRegistered("meal");
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  function confirmMeal(applied: boolean) {
    if (!pending || submitting.current || !rapidOptions.some((r) => r.id === insulinId)) return;
    const actual = new Date(appliedAt).getTime();
    if (applied && (!Number.isFinite(actual) || actual > Date.now() + 5 * 60000)) return;
    const entered =
      mode === "cloud"
        ? administrationSchema.safeParse({
            insulin_id: insulinId,
            dose: manualDose,
            administered_at: applied ? new Date(actual).toISOString() : pending.meal.eaten_at,
            purpose: pending.purpose,
            status: applied ? "performed" : "planned",
            confirmed: applied,
            glucose_before: "",
            recorded_by_name: "Registro manual",
          })
        : null;
    if (entered && !entered.success) {
      setConfirmationError(entered.error.issues[0]?.message ?? "Confira a dose informada.");
      return;
    }
    submitting.current = true;
    saveTogether.mutate(
      {
        meal: pending.meal,
        requestId: pending.requestId,
        administration: {
          insulin_id: insulinId,
          dose: entered?.success ? entered.data.dose : pending.dose,
          administered_at: applied ? new Date(actual).toISOString() : pending.meal.eaten_at,
          purpose: pending.purpose,
          status: applied ? "performed" : "planned",
          confirmed: applied,
          glucose_before: pending.glucose,
          injection_site: null,
          recorded_by_name: mode === "demo" ? "Demonstração" : "Registro manual",
          notes: `Refeição: ${MEAL_LABEL[pending.meal.meal_type]} · ${fmtNum(pending.meal.totals.carbs_g)} g de carboidratos.`,
        },
      },
      {
        onSuccess: () => {
          clearMeal();
          setRegistered(applied ? "performed" : "planned");
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }

  function saveMealOnly() {
    if (!pending || submitting.current) return;
    submitting.current = true;
    save.mutate(pending.meal, {
      onSuccess: () => {
        clearMeal();
        setRegistered("meal");
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alimentação"
        back={false}
        action={
          <Button asChild variant="soft" size="sm">
            <Link to="/alimentacao/historico">
              <History aria-hidden /> Histórico
            </Link>
          </Button>
        }
      />
      {registered && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm"
        >
          <span>
            {registered === "performed"
              ? "Refeição e aplicação registradas."
              : registered === "planned"
                ? "Refeição registrada. A aplicação ficou pendente."
                : "Refeição registrada sem aplicação."}
          </span>
          {registered !== "meal" && (
            <Link to="/monitor/insulina" className="font-semibold text-primary">
              {registered === "planned" ? "Ver aplicação pendente" : "Ver aplicação"}
            </Link>
          )}
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="mb-2 cursor-pointer font-semibold">
          TACO · 597 alimentos · valores por 100 g
        </summary>
        <Notice tone="info" icon={<Info className="mt-0.5 h-4 w-4 shrink-0" />}>
          TACO 4ª edição (NEPA/UNICAMP) disponível: 597 alimentos, com valores por 100 g da parte
          comestível. Preserve o preparo indicado no nome ao escolher o alimento.
          {mode === "demo" && (
            <>
              {" "}
              Os alimentos identificados como exemplos têm valores <strong>fictícios</strong> e não
              devem ser usados para decisões.
            </>
          )}
        </Notice>
      </details>

      <div className="food-workspace">
        <div className="food-search space-y-5">
          <section>
            <CardTitle
              icon={<Search className="h-4 w-4" />}
              action={
                !readOnly && (
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/alimentacao/novo">
                      <Plus aria-hidden /> Cadastrar
                    </Link>
                  </Button>
                )
              }
            >
              Buscar alimento
            </CardTitle>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Ex.: arroz, feijão…"
                aria-label="Buscar alimento"
                className={`${inputCls} pl-10`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {!normalizeFoodSearch(q) ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Digite o nome de um alimento para pesquisar na TACO.
              </p>
            ) : foods.isLoading ? (
              <LoadingState />
            ) : foods.error ? (
              <ErrorState error={foods.error} />
            ) : !suggestions.length ? (
              <EmptyState title="Nenhum alimento encontrado">
                {!readOnly && (
                  <Link to="/alimentacao/novo" className="font-semibold text-primary">
                    Cadastrar manualmente
                  </Link>
                )}
              </EmptyState>
            ) : (
              <ul className="mt-2 divide-y" aria-label="Sugestões">
                {suggestions.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 py-2">
                    <button
                      className="min-w-0 flex-1 rounded-lg py-1 text-left"
                      onClick={() => addFood(f)}
                      disabled={readOnly}
                    >
                      <p className="food-result-name">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          f.preparation,
                          FOOD_STATE_LABEL[f.state] !== "—" && FOOD_STATE_LABEL[f.state],
                        ]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        ·{" "}
                        <span
                          className={cn(
                            f.source === "fictional_example" && "font-semibold text-sim",
                          )}
                        >
                          {FOOD_SOURCE_LABEL[f.source]}
                        </span>{" "}
                        · {fmtNum(f.carbs_per_100g)} g carb/100 g
                      </p>
                      <div className="food-nutrients">
                        <span>{fmtNum(f.carbs_per_100g)} g carb</span>
                        <span>{fmtNum(f.protein_per_100g)} g proteína</span>
                        <span>{fmtNum(f.fat_per_100g)} g lipídios</span>
                        <span>{fmtNum(f.kcal_per_100g)} kcal</span>
                      </div>
                    </button>
                    {f.patient_id && !readOnly && (
                      <button
                        onClick={() => toggleFav.mutate({ id: f.id, fav: !f.is_favorite })}
                        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
                        aria-label={
                          f.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
                        }
                        aria-pressed={f.is_favorite}
                      >
                        <Star
                          className={cn(
                            "h-5 w-5",
                            f.is_favorite ? "fill-warning text-warning" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                      </button>
                    )}
                    {!readOnly && (
                      <Button
                        size="icon"
                        variant="soft"
                        onClick={() => addFood(f)}
                        aria-label={`Adicionar ${f.name}`}
                      >
                        <Plus aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {favMeals.length > 0 && !readOnly && (
            <section>
              <CardTitle icon={<Star className="h-4 w-4" />}>Refeições favoritas</CardTitle>
              <div className="flex flex-wrap gap-2">
                {favMeals.map((m) => (
                  <Button
                    key={m.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const fs = foods.data ?? [];
                      setLines(
                        m.items.flatMap((it) => {
                          const f = fs.find((x) => x.id === it.food_id);
                          return f
                            ? [
                                {
                                  key: crypto.randomUUID(),
                                  food: f,
                                  grams: String(it.grams).replace(".", ","),
                                  includesInedible: false,
                                },
                              ]
                            : [];
                        }),
                      );
                      setMealType(m.meal_type);
                    }}
                  >
                    {m.favorite_name ?? MEAL_LABEL[m.meal_type]}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </div>
        <section className="meal-composer">
          <CardTitle icon={<Utensils className="h-4 w-4" />}>Composição da refeição</CardTitle>
          {!lines.length ? (
            <EmptyState title="Nenhum alimento adicionado">
              Busque e toque em um alimento para adicionar.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {computed.map(({ line, item, error }) => (
                <li key={line.key} className="border-b py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="food-result-name">{line.food.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {FOOD_SOURCE_LABEL[line.food.source]}
                        {line.food.state !== "not_applicable" &&
                          ` · valores para alimento ${FOOD_STATE_LABEL[line.food.state].toLowerCase()}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-destructive hover:bg-danger-soft"
                      aria-label={`Remover ${line.food.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {item && (
                    <div className="food-nutrients">
                      <span>{fmtNum(item.protein_g)} g proteína</span>
                      <span>{fmtNum(item.fat_g)} g lipídios</span>
                      <span>{fmtNum(item.kcal)} kcal</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      aria-label={`Quantidade em gramas de ${line.food.name}`}
                      placeholder="Gramas"
                      className="h-11 w-28 text-base"
                      value={line.grams}
                      onChange={(e) =>
                        setLines(
                          lines.map((l) =>
                            l.key === line.key ? { ...l, grams: e.target.value } : l,
                          ),
                        )
                      }
                      aria-invalid={!!error && line.grams !== ""}
                    />
                    <span className="text-sm text-muted-foreground">g</span>
                    {item && (
                      <span className="ml-auto text-right text-sm font-bold">
                        {fmtNum(item.carbs_g)} g carb
                      </span>
                    )}
                  </div>
                  {error && line.grams !== "" && (
                    <p role="alert" className="mt-1 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  {line.food.edible_portion_pct < 100 && (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={line.includesInedible}
                        onCheckedChange={(v) =>
                          setLines(
                            lines.map((l) =>
                              l.key === line.key ? { ...l, includesInedible: v === true } : l,
                            ),
                          )
                        }
                      />
                      Peso inclui partes não comestíveis (parte comestível:{" "}
                      {fmtNum(line.food.edible_portion_pct, 0)}%)
                    </label>
                  )}
                </li>
              ))}
            </ul>
          )}

          <dl className="meal-macros mt-4" aria-live="polite">
            <Total label="Carboidratos" value={totals.carbs_g} unit="g" strong />
            <Total label="Proteínas" value={totals.protein_g} unit="g" />
            <Total label="Gorduras" value={totals.fat_g} unit="g" />
            <Total label="Calorias" value={totals.kcal} unit="kcal" />
          </dl>
          {totals.hasMissing && (
            <p className="mt-2 text-xs text-warning-foreground">
              “—” indica que algum alimento não possui esse valor na fonte; o total não é estimado.
              {totals.missingFields.includes("carbs") &&
                " Total de carboidratos incompleto: falta o valor de ao menos um alimento. O registro da refeição está bloqueado."}
            </p>
          )}
          <DemoMealDoseCalculator dose={dose} />

          {!readOnly && lines.length > 0 && (
            <div className="mt-4 space-y-3">
              <Field id="mt" label="Refeição">
                <select
                  id="mt"
                  className={selectCls}
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                >
                  {(Object.keys(MEAL_LABEL) as MealType[]).map((k) => (
                    <option key={k} value={k}>
                      {MEAL_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="et" label="Horário">
                <Input
                  id="et"
                  type="datetime-local"
                  className={inputCls}
                  value={eatenAt}
                  onChange={(e) => setEatenAt(e.target.value)}
                />
              </Field>
              <Field id="nt" label="Observações" optional>
                <Textarea
                  id="nt"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={fav} onCheckedChange={(v) => setFav(v === true)} /> Salvar como
                refeição favorita
              </label>
              {fav && (
                <Input
                  aria-label="Nome da favorita"
                  placeholder="Nome (ex.: Café padrão)"
                  className={inputCls}
                  value={favName}
                  onChange={(e) => setFavName(e.target.value)}
                  maxLength={80}
                />
              )}
              <Button
                size="lg"
                className="w-full"
                disabled={
                  !allValid ||
                  totals.carbs_g == null ||
                  save.isPending ||
                  saveTogether.isPending ||
                  !Number.isFinite(new Date(eatenAt).getTime()) ||
                  (mode === "demo" && !dose.result)
                }
                onClick={submit}
              >
                {save.isPending ? "Salvando…" : "Registrar refeição"}
              </Button>
            </div>
          )}
        </section>
      </div>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !submitting.current) setPending(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>A insulina foi aplicada?</DialogTitle>
            <DialogDescription>
              {mode === "demo"
                ? "Registro da refeição e da aplicação na demonstração."
                : "Informe somente uma aplicação ou planejamento já definido. O resultado da simulação não é transferido para este registro."}
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <>
              <dl className="confirmation-summary">
                <div>
                  <dt>Refeição</dt>
                  <dd>
                    {MEAL_LABEL[pending.meal.meal_type]} · {fmtNum(pending.meal.totals.carbs_g)} g
                    carb
                  </dd>
                </div>
                {mode === "demo" && (
                  <div>
                    <dt>Glicemia do monitor</dt>
                    <dd>{fmtNum(pending.glucose)} mg/dL</dd>
                  </div>
                )}
                {mode === "demo" && (
                  <div>
                    <dt>Dose calculada</dt>
                    <dd className="text-xl text-primary">{fmtNum(pending.dose, 2)} UI</dd>
                  </div>
                )}
              </dl>
              {mode === "cloud" && (
                <Field id="meal-manual-dose" label="Dose informada (UI)">
                  <Input
                    id="meal-manual-dose"
                    inputMode="decimal"
                    className={inputCls}
                    value={manualDose}
                    onChange={(e) => setManualDose(e.target.value)}
                  />
                </Field>
              )}
              <Field id="meal-insulin" label="Insulina rápida">
                <select
                  id="meal-insulin"
                  value={insulinId}
                  className={selectCls}
                  onChange={(e) => setInsulinId(e.target.value)}
                >
                  {!rapidOptions.length && <option value="">Nenhuma insulina rápida em uso</option>}
                  {rapidOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.brand_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="meal-applied-at" label="Horário efetivo da aplicação">
                <Input
                  id="meal-applied-at"
                  type="datetime-local"
                  className={inputCls}
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Refeição em {fmtDateTime(pending.meal.eaten_at)}. A opção “Não” mantém a aplicação
                pendente no histórico.
              </p>
              {saveTogether.error && <ErrorState error={saveTogether.error} />}
              {save.error && <ErrorState error={save.error} />}
              {confirmationError && (
                <p role="alert" className="text-sm text-destructive">
                  {confirmationError}
                </p>
              )}
              {!rapidOptions.length && (
                <Link to="/config/insulinas" className="text-sm font-semibold text-primary">
                  Cadastrar uma insulina rápida
                </Link>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled={
                    saveTogether.isPending ||
                    save.isPending ||
                    !insulinId ||
                    (mode === "cloud" &&
                      !decimalString({
                        min: 0.5,
                        max: 300,
                        label: "a dose",
                        maxDecimals: 1,
                      }).safeParse(manualDose).success)
                  }
                  onClick={() => confirmMeal(false)}
                >
                  <Clock3 aria-hidden /> Não, registrar pendente
                </Button>
                <Button
                  disabled={
                    saveTogether.isPending ||
                    save.isPending ||
                    (mode === "cloud" &&
                      !decimalString({
                        min: 0.5,
                        max: 300,
                        label: "a dose",
                        maxDecimals: 1,
                      }).safeParse(manualDose).success) ||
                    !insulinId ||
                    !Number.isFinite(new Date(appliedAt).getTime()) ||
                    new Date(appliedAt).getTime() > Date.now() + 5 * 60000
                  }
                  onClick={() => confirmMeal(true)}
                >
                  <Check aria-hidden /> Sim, registrar aplicação
                </Button>
              </div>
              {mode === "cloud" && (
                <Button
                  variant="outline"
                  disabled={saveTogether.isPending || save.isPending}
                  onClick={saveMealOnly}
                >
                  <Utensils aria-hidden /> Registrar somente refeição
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={saveTogether.isPending}
                onClick={() => setPending(null)}
              >
                <Syringe aria-hidden /> Voltar à refeição
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Total({
  label,
  value,
  unit,
  strong,
}: {
  label: string;
  value: number | null;
  unit: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("font-extrabold", strong ? "text-xl text-primary" : "text-base")}>
        {value == null ? "—" : fmtNum(value)}
        <span className="text-xs font-semibold"> {unit}</span>
      </dd>
    </div>
  );
}
