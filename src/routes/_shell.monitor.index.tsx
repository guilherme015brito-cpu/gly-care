import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Droplet, History, RefreshCw, Syringe, Utensils, CloudOff, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { RANGE_HOURS, type RangeKey, useAdministrations, useCatalog, useGlucose, useKetones, useMeals, usePatientInsulins, useSettings } from "@/hooks/use-data";
import { useOnline } from "@/hooks/use-online";
import { classifyGlucose, isStale, STALE_AFTER_MIN } from "@/lib/glucose/status";
import { PURPOSE_LABEL, TREND_LABEL, fmtDateTime, relativeAge } from "@/lib/domain/labels";
import { BandBadge, Card, CardTitle, EmptyState, ErrorState, LoadingState, Notice, SourceBadge, TrendArrow } from "@/components/glycare/ui-bits";
import { GlucoseChart } from "@/components/glycare/GlucoseChart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/monitor/")({
  head: () => ({
    meta: [
      { title: "Monitoramento — GlyCare" },
      { name: "description", content: "Glicemia atual, gráfico, insulina e ações rápidas." },
      { property: "og:title", content: "Monitoramento — GlyCare" },
      { property: "og:description", content: "Glicemia atual, gráfico, insulina e ações rápidas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { patient, mode, readOnly } = useApp();
  const [range, setRange] = useState<RangeKey>("6h");
  const [glucoseTab, setGlucoseTab] = useState<"current" | "chart">("current");
  const hours = RANGE_HOURS[range];
  const glucose = useGlucose(hours);
  const latestQ = useGlucose(24);
  const settings = useSettings();
  const admins = useAdministrations(50);
  const catalog = useCatalog();
  const patientInsulins = usePatientInsulins();
  const meals = useMeals(30);
  const ketones = useKetones(30);
  const online = useOnline();

  const latest = latestQ.data?.filter((r) => r.quality !== "invalid").at(-1);
  const stale = isStale(latest);
  const band = latest && settings.data ? classifyGlucose(latest.value_mgdl, settings.data) : null;
  const lastAdmin = admins.data?.find((a) => !a.is_superseded && a.status === "performed");
  const insulinName = (id: string) => catalog.data?.find((c) => c.id === id)?.brand_name ?? "Insulina";
  const rapidIds = new Set(patientInsulins.data?.filter((i) => i.role === "rapid").map((i) => i.insulin_id) ?? []);
  const basalInUse = patientInsulins.data?.filter((i) => i.active && i.role === "basal") ?? [];
  const timeNow = Date.now();
  const recentRapid = (admins.data ?? [])
    .filter((a) => a.status === "performed" && a.confirmed_by_user && !a.is_superseded &&
      rapidIds.has(a.insulin_id) && Date.parse(a.administered_at) <= timeNow &&
      Date.parse(a.administered_at) >= timeNow - 7 * 3600000)
    .slice(0, 5);


  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-muted-foreground">Acompanhando</p>
          <h1 className="text-2xl font-extrabold">{patient?.nickname}</h1>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", online ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground")} role="status">
          {online ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <CloudOff className="h-3.5 w-3.5" aria-hidden />}
          {online ? (mode === "demo" ? "Local (demo)" : "Conectado") : "Offline"}
        </span>
      </header>

      {/* Glucose summary and trend share a single, keyboard-accessible card. */}
      <Card>
        <div role="tablist" aria-label="Visualização da glicemia" className="mb-4 grid grid-cols-2 rounded-xl bg-muted p-1">
          <button type="button" role="tab" id="tab-glucose-current" aria-selected={glucoseTab === "current"} aria-controls="panel-glucose-current" onClick={() => setGlucoseTab("current")} className={cn("min-h-11 rounded-lg text-sm font-bold", glucoseTab === "current" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Glicemia atual</button>
          <button type="button" role="tab" id="tab-glucose-chart" aria-selected={glucoseTab === "chart"} aria-controls="panel-glucose-chart" onClick={() => setGlucoseTab("chart")} className={cn("min-h-11 rounded-lg text-sm font-bold", glucoseTab === "chart" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Gráfico</button>
        </div>
        <section role="tabpanel" id="panel-glucose-current" aria-labelledby="tab-glucose-current" hidden={glucoseTab !== "current"}>
      <div aria-labelledby="g-title">
        <div className="flex items-center justify-between">
          <h2 id="g-title" className="text-sm font-semibold text-muted-foreground">Glicemia mais recente</h2>
          <button onClick={() => latestQ.refetch()} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Atualizar leituras">
            <RefreshCw className={cn("h-4 w-4", latestQ.isFetching && "animate-spin")} aria-hidden />
          </button>
        </div>
        {latestQ.isLoading ? (
          <LoadingState />
        ) : latestQ.error ? (
          <ErrorState error={latestQ.error} />
        ) : !latest ? (
          <EmptyState title="Nenhuma leitura nas últimas 24 h">Registre uma glicemia manual ou configure uma fonte de dados.</EmptyState>
        ) : (
          <>
            <div className={cn("flex items-end gap-3", stale && "opacity-60")}>
              <p className="font-display text-6xl font-extrabold leading-none tracking-tight" aria-label={`${latest.value_mgdl} miligramas por decilitro`}>
                {Math.round(latest.value_mgdl)}
              </p>
              <div className="pb-1">
                <p className="text-sm font-semibold text-muted-foreground">mg/dL</p>
                <TrendArrow trend={latest.trend} className="text-foreground" />
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{TREND_LABEL[latest.trend]}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {band && <BandBadge band={band} />}
              <SourceBadge source={latest.source} />
            </div>
            <p className="mt-3 text-sm">
              Medida em <strong>{fmtDateTime(latest.measured_at)}</strong> ({relativeAge(latest.measured_at)})
              {latest.unit !== "mg/dL" && <> · original: {latest.value} {latest.unit}</>}
            </p>
            {stale && (
              <div className="mt-3">
                <Notice tone="warning">
                  Leitura desatualizada (mais de {STALE_AFTER_MIN} min). Não há dados mais recentes — confira o sensor ou glicosímetro.
                </Notice>
              </div>
            )}
            {latest.value_mgdl >= 250 && latest.source !== "simulation" && (
              <div className="mt-3">
                <Notice tone="warning">
                  <strong>Glicemia muito alta.</strong> Confira a leitura e siga o plano prescrito. Se a hiperglicemia persistir ou houver doença, confira as cetonas conforme a orientação da equipe. Vômitos, dor abdominal, respiração diferente ou sonolência exigem avaliação médica urgente.
                </Notice>
              </div>
            )}
            {latest.source === "simulation" && (
              <div className="mt-3">
                <Notice tone="sim">Valor SIMULADO para demonstração. Não representa a paciente.</Notice>
              </div>
            )}
          </>
        )}
        <Link to="/monitor/glicemia" className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-muted">
          <Droplet className="h-4 w-4" aria-hidden />
          {readOnly ? "Ver histórico de glicemia" : "Registrar glicemia manual"}
        </Link>
      </div>
        </section>
        <section role="tabpanel" id="panel-glucose-chart" aria-labelledby="tab-glucose-chart" hidden={glucoseTab !== "chart"}>
      <div>
        <CardTitle icon={<Activity className="h-4 w-4" />}>Gráfico de glicemia</CardTitle>
        <div role="radiogroup" aria-label="Período" className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-muted p-1">
          {(Object.keys(RANGE_HOURS) as RangeKey[]).map((k) => (
            <button key={k} role="radio" aria-checked={range === k} onClick={() => setRange(k)} className={cn("h-9 rounded-lg text-sm font-semibold", range === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
              {k.replace("d", " d").replace("h", " h")}
            </button>
          ))}
        </div>
        {glucose.isLoading || !settings.data ? (
          <LoadingState />
        ) : glucose.error ? (
          <ErrorState error={glucose.error} />
        ) : !glucose.data?.length ? (
          <EmptyState title="Sem leituras neste período" />
        ) : (
          <GlucoseChart readings={glucose.data} settings={settings.data} meals={meals.data ?? []} admins={admins.data ?? []} ketones={ketones.data ?? []} hours={hours} />
        )}
      </div>
        </section>
      </Card>

      {/* Main actions: simple and immediately accessible. */}
      <section aria-label="Ações principais" className="grid grid-cols-2 gap-3">
        <QuickAction to="/monitor/insulina/nova" icon={<Syringe />} label="Registrar insulina" primary />
        <QuickAction to="/alimentacao" icon={<Utensils />} label="Registrar refeição" />
      </section>

      {/* A compact summary; full insulin history remains one tap away. */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle icon={<Syringe className="h-4 w-4" />}>Insulina</CardTitle>
          <Link to="/monitor/insulina" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
            <History className="h-4 w-4" aria-hidden />
            Histórico
          </Link>
        </div>
        {admins.isLoading ? (
          <LoadingState />
        ) : admins.error ? (
          <ErrorState error={admins.error} />
        ) : !lastAdmin ? (
          <p className="text-sm text-muted-foreground">Nenhuma aplicação informada.</p>
        ) : (
          <div className="rounded-xl bg-primary-soft p-3">
            <p className="text-xs font-medium text-muted-foreground">Última aplicação informada</p>
            <p className="mt-1 text-lg font-bold">
              {lastAdmin.dose_units.toLocaleString("pt-BR")} UI · {insulinName(lastAdmin.insulin_id)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {PURPOSE_LABEL[lastAdmin.purpose]} · {fmtDateTime(lastAdmin.administered_at)} ({relativeAge(lastAdmin.administered_at)})
            </p>
          </div>
        )}
        <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-sm font-semibold">Aplicações rápidas nas últimas 7 horas</p>
          {admins.isLoading || patientInsulins.isLoading ? (
            <LoadingState />
          ) : recentRapid.length ? (
            <ul className="space-y-1 text-sm">
              {recentRapid.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-1">
                  <span>{insulinName(a.insulin_id)} · {a.dose_units.toLocaleString("pt-BR")} UI</span>
                  <span className="text-muted-foreground">{relativeAge(a.administered_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma aplicação rápida confirmada neste período do histórico consultado.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Fiasp costuma agir por várias horas; os registros acima não determinam o IOB, nem se é seguro repetir uma dose.
          </p>
          <p className="text-xs text-muted-foreground">
            Insulina basal{basalInUse.length ? ` em uso: ${basalInUse.map((i) => insulinName(i.insulin_id)).join(", ")}` : ""}.
            Ação prolongada, acompanhada separadamente. Não é somada à insulina rápida.
          </p>
        </div>
      </Card>

      <p className="px-2 pb-2 text-center text-xs text-muted-foreground">
        O GlyCare não sugere doses e não substitui o sensor, glicosímetro ou orientação médica.
      </p>
    </div>
  );
}

function QuickAction({ to, icon, label, primary, className }: { to: string; icon: React.ReactNode; label: string; primary?: boolean; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl p-4 text-left font-semibold [&_svg]:h-6 [&_svg]:w-6",
        primary ? "bg-primary text-primary-foreground shadow" : "card-surface",
        className,
      )}
    >
      <span className={primary ? "" : "text-primary"} aria-hidden>{icon}</span>
      {label}
    </Link>
  );
}
