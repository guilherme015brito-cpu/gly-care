import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock3, Droplet, History, RefreshCw, Syringe, Utensils, ArrowUpRight } from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  RANGE_HOURS,
  type RangeKey,
  useAdministrations,
  useCatalog,
  useGlucose,
  useKetones,
  useMeals,
  useSettings,
} from "@/hooks/use-data";
import { classifyGlucose, isStale, STALE_AFTER_MIN } from "@/lib/glucose/status";
import {
  PURPOSE_LABEL,
  MEAL_LABEL,
  TREND_LABEL,
  fmtDateTime,
  relativeAge,
  fmtNum,
} from "@/lib/domain/labels";
import {
  BandBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  SourceBadge,
  TrendArrow,
} from "@/components/glycare/ui-bits";
import { GlucoseChart } from "@/components/glycare/GlucoseChart";
import { DemoDoseCalculator } from "@/components/glycare/DemoDoseCalculator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/monitor/")({
  head: () => ({
    meta: [
      { title: "Monitoramento — GlyCare" },
      { name: "description", content: "Glicemia atual, evolução e registros do acompanhamento." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { patient, mode } = useApp();
  const [range, setRange] = useState<RangeKey>("24h");
  const hours = RANGE_HOURS[range];
  const glucose = useGlucose(hours);
  const latestQ = useGlucose(24);
  const settings = useSettings();
  const admins = useAdministrations(50);
  const catalog = useCatalog();
  const meals = useMeals(50);
  const ketones = useKetones(50);
  const latest = latestQ.data?.filter((r) => r.quality !== "invalid").at(-1);
  const stale = isStale(latest);
  const band = latest && settings.data ? classifyGlucose(latest.value_mgdl, settings.data) : null;
  const valid = (glucose.data ?? []).filter((r) => r.quality === "valid");
  const inRange = settings.data
    ? valid.filter(
        (r) =>
          r.value_mgdl >= settings.data!.target_low_mgdl &&
          r.value_mgdl <= settings.data!.target_high_mgdl,
      ).length
    : 0;
  const average = valid.length
    ? valid.reduce((sum, r) => sum + r.value_mgdl, 0) / valid.length
    : null;
  const sampleRange =
    valid.length && settings.data ? Math.round((inRange / valid.length) * 100) : null;
  const applications = (admins.data ?? []).filter((a) => !a.is_superseded);
  const insulinName = (id: string) =>
    catalog.data?.find((c) => c.id === id)?.brand_name ?? "Insulina";
  const gaugeMax = Math.max(300, settings.data?.very_high_mgdl ?? 300, latest?.value_mgdl ?? 0);
  const position = (value: number) => Math.max(1, Math.min(99, (value / gaugeMax) * 100));

  return (
    <div>
      <header className="page-heading">
        <div>
          <h1>Monitoramento</h1>
          <p>
            {patient?.nickname} ·{" "}
            {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          title="Atualizar leituras"
          aria-label="Atualizar leituras"
          className="icon-button"
          onClick={() => {
            void latestQ.refetch();
            void glucose.refetch();
          }}
        >
          <RefreshCw size={17} className={cn(latestQ.isFetching && "animate-spin")} />
        </button>
      </header>
      <div className="monitor-overview">
        <section
          className="glucose-summary"
          data-band={band ?? undefined}
          aria-labelledby="g-title"
        >
          <h2 id="g-title" className="section-eyebrow">
            <Droplet size={15} aria-hidden />
            Glicemia atual
          </h2>
          {latestQ.isLoading ? (
            <LoadingState />
          ) : latestQ.error ? (
            <ErrorState error={latestQ.error} />
          ) : !latest ? (
            <EmptyState title="Nenhuma leitura nas últimas 24 h">
              Registre uma glicemia ou configure uma fonte.
            </EmptyState>
          ) : (
            <>
              <div className={cn("glucose-value", stale && "opacity-60")}>
                <strong aria-label={`${latest.value_mgdl} miligramas por decilitro`}>
                  {Math.round(latest.value_mgdl)}
                </strong>
                <div>
                  <p className="unit">mg/dL</p>
                  <p className="trend">
                    <TrendArrow trend={latest.trend} />
                    <span aria-hidden>{TREND_LABEL[latest.trend]}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {band && <BandBadge band={band} />}
                <SourceBadge source={latest.source} />
              </div>
              {settings.data && (
                <>
                  <div className="range-track" aria-hidden>
                    <span
                      className="range-target"
                      style={{
                        left: `${position(settings.data.target_low_mgdl)}%`,
                        width: `${position(settings.data.target_high_mgdl) - position(settings.data.target_low_mgdl)}%`,
                      }}
                    />
                    <span
                      className="range-marker"
                      style={{ left: `${position(latest.value_mgdl)}%` }}
                    />
                  </div>
                  <p className="range-labels">
                    <span>Faixa-alvo</span>
                    <strong>
                      {settings.data.target_low_mgdl}–{settings.data.target_high_mgdl} mg/dL
                    </strong>
                  </p>
                </>
              )}
              <p className="reading-timestamp">
                <Clock3 size={13} aria-hidden />
                <time dateTime={latest.measured_at}>{fmtDateTime(latest.measured_at)}</time> ·{" "}
                {relativeAge(latest.measured_at)}
              </p>
              {latest.unit !== "mg/dL" && (
                <p className="text-xs text-muted-foreground">
                  Original: {latest.value} {latest.unit}
                </p>
              )}
              {latest.quality === "questionable" && (
                <div className="mt-3">
                  <Notice tone="warning">
                    Qualidade da leitura questionável. Confira a fonte.
                  </Notice>
                </div>
              )}
              {stale && (
                <div className="mt-3">
                  <Notice tone="warning">
                    Leitura desatualizada: mais de {STALE_AFTER_MIN} min. Confira a fonte.
                  </Notice>
                </div>
              )}
            </>
          )}
        </section>
        <section className="chart-section" aria-labelledby="curve-title">
          <div className="chart-toolbar">
            <h2 id="curve-title">
              {range === "24h" ? "Curva das últimas 24 horas" : "Evolução da glicemia"}
            </h2>
            <div role="radiogroup" aria-label="Período" className="period-control">
              {(Object.keys(RANGE_HOURS) as RangeKey[]).map((k) => (
                <button key={k} role="radio" aria-checked={range === k} onClick={() => setRange(k)}>
                  {k.replace("d", " d").replace("h", " h")}
                </button>
              ))}
            </div>
          </div>
          {settings.error ? (
            <ErrorState error={settings.error} />
          ) : glucose.error ? (
            <ErrorState error={glucose.error} />
          ) : glucose.isLoading || !settings.data ? (
            <LoadingState />
          ) : !glucose.data?.length ? (
            <EmptyState title="Sem leituras neste período" />
          ) : (
            <GlucoseChart
              readings={glucose.data}
              settings={settings.data}
              meals={meals.data ?? []}
              admins={admins.data ?? []}
              ketones={ketones.data ?? []}
              hours={hours}
            />
          )}
        </section>
      </div>
      {mode === "demo" && (
        <DemoDoseCalculator
          kind="correction"
          at={latest?.measured_at ?? new Date().toISOString()}
          reading={latest}
        />
      )}
      <dl className="monitor-stats">
        <div>
          <dt>Leituras na faixa</dt>
          <dd>{sampleRange == null ? "—" : `${sampleRange}%`}</dd>
          <p>
            {valid.length} leituras válidas · {range}
          </p>
        </div>
        <div>
          <dt>Glicemia média</dt>
          <dd>
            {average == null ? "—" : Math.round(average)} <small>mg/dL</small>
          </dd>
          <p>Mesmo período selecionado</p>
        </div>
        <div>
          <dt>Variação no período</dt>
          <dd>
            {valid.length
              ? `${Math.round(Math.min(...valid.map((r) => r.value_mgdl)))}–${Math.round(Math.max(...valid.map((r) => r.value_mgdl)))}`
              : "—"}
          </dd>
          <p>Mínima e máxima · mg/dL</p>
        </div>
      </dl>
      <section className="quick-actions" aria-label="Ações rápidas">
        <Link to="/alimentacao" className="primary">
          <Utensils />
          Montar refeição
        </Link>
        <Link to="/monitor/insulina/nova">
          <Syringe />
          Registrar insulina
        </Link>
        <Link to="/monitor/glicemia">
          <Droplet />
          Glicemia manual
        </Link>
        <Link to="/monitor/insulina">
          <History />
          Histórico
        </Link>
      </section>
      <div className="monitor-details">
        <section>
          <div className="section-heading">
            <h2>Insulina administrada</h2>
            <Link to="/monitor/insulina">
              Ver histórico <ArrowUpRight className="inline" size={13} />
            </Link>
          </div>
          {admins.isLoading ? (
            <LoadingState />
          ) : admins.error ? (
            <ErrorState error={admins.error} />
          ) : !applications.length ? (
            <EmptyState title="Nenhuma aplicação registrada" />
          ) : (
            <ul>
              {applications.slice(0, 3).map((a) => (
                <li className="activity-row" key={a.id}>
                  <Syringe aria-hidden />
                  <div className="activity-copy">
                    <strong>
                      {PURPOSE_LABEL[a.purpose]}
                      {a.status === "planned" && " · Planejada"}
                    </strong>
                    <p>{insulinName(a.insulin_id)}</p>
                    <p>
                      {fmtDateTime(a.administered_at)} · {relativeAge(a.administered_at)}
                    </p>
                  </div>
                  <strong>
                    {fmtNum(a.dose_units)} <small>UI</small>
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>Refeições recentes</h2>
            <Link to="/alimentacao/historico">
              Ver histórico <ArrowUpRight className="inline" size={13} />
            </Link>
          </div>
          {meals.isLoading ? (
            <LoadingState />
          ) : meals.error ? (
            <ErrorState error={meals.error} />
          ) : !meals.data?.length ? (
            <EmptyState title="Nenhuma refeição registrada" />
          ) : (
            <ul>
              {meals.data.slice(0, 3).map((m) => (
                <li className="activity-row" key={m.id}>
                  <Utensils aria-hidden />
                  <div className="activity-copy">
                    <strong>{MEAL_LABEL[m.meal_type]}</strong>
                    <p>{m.items.map((i) => i.food_name).join(" · ")}</p>
                    <p>{fmtDateTime(m.eaten_at)}</p>
                  </div>
                  <strong>
                    {fmtNum(m.total_carbs_g)} <small>g carb</small>
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
