import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, EmptyState, ErrorState, LoadingState, SourceBadge } from "@/components/glycare/ui-bits";
import { useGlucose, useMeals } from "@/hooks/use-data";
import { MEAL_LABEL, fmtDateTime, fmtNum, fmtTime } from "@/lib/domain/labels";
import type { GlucoseReading, MealType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/alimentacao/historico")({
  head: () => ({
    meta: [
      { title: "Histórico alimentar — GlyCare" },
      { name: "description", content: "Refeições registradas com alimentos, quantidades e carboidratos." },
      { property: "og:title", content: "Histórico alimentar — GlyCare" },
      { property: "og:description", content: "Refeições registradas com alimentos, quantidades e carboidratos." },
    ],
  }),
  component: MealHistory,
});

const NEAR_MIN = 30;

/** Closest valid reading within ±30 min. Returns nothing if none — never estimated. */
function nearestReading(readings: GlucoseReading[], iso: string) {
  const t = new Date(iso).getTime();
  let best: GlucoseReading | undefined;
  for (const r of readings) {
    if (r.quality !== "valid") continue;
    const d = Math.abs(new Date(r.measured_at).getTime() - t);
    if (d <= NEAR_MIN * 60000 && (!best || d < Math.abs(new Date(best.measured_at).getTime() - t))) best = r;
  }
  return best;
}

function MealHistory() {
  const meals = useMeals(200);
  const glucose = useGlucose(168);
  const [filter, setFilter] = useState<MealType | "all">("all");
  const list = (meals.data ?? []).filter((m) => filter === "all" || m.meal_type === filter);

  return (
    <div className="space-y-4">
      <PageHeader title="Histórico alimentar" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Tipo de refeição">
        {(["all", ...Object.keys(MEAL_LABEL)] as Array<MealType | "all">).map((k) => (
          <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold", filter === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border")}>
            {k === "all" ? "Todas" : MEAL_LABEL[k]}
          </button>
        ))}
      </div>
      {meals.isLoading ? <LoadingState /> : meals.error ? <ErrorState error={meals.error} /> : !list.length ? <EmptyState title="Nenhuma refeição registrada" /> : (
        list.map((m) => {
          const g = nearestReading(glucose.data ?? [], m.eaten_at);
          return (
            <Card key={m.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{MEAL_LABEL[m.meal_type]}{m.is_favorite && m.favorite_name ? ` · ★ ${m.favorite_name}` : ""}</p>
                  <p className="text-sm text-muted-foreground">{fmtDateTime(m.eaten_at)}</p>
                </div>
                <p className="text-right text-2xl font-extrabold text-primary">{fmtNum(m.total_carbs_g)}<span className="text-sm font-semibold"> g carb</span></p>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {m.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2"><span className="truncate">{it.food_name} · {fmtNum(it.grams)} g</span><span className="shrink-0 text-muted-foreground">{fmtNum(it.carbs_g)} g</span></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Prot. {fmtNum(m.total_protein_g)} g · Gord. {fmtNum(m.total_fat_g)} g · {fmtNum(m.total_kcal, 0)} kcal{m.has_missing_values && " · alguns valores ausentes na fonte"}</p>
              {m.notes && <p className="mt-1 text-sm">{m.notes}</p>}
              {g && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2 text-xs">
                  <span>Glicemia próxima: <strong>{Math.round(g.value_mgdl)} mg/dL</strong> às {fmtTime(g.measured_at)}</span>
                  <SourceBadge source={g.source} />
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
