import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Syringe } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdministrations, useCatalog } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import {
  DEMO_INSULIN_PROFILES,
  demoActionApplications,
  demoActionSeries,
} from "@/lib/insulin/demo-action";
import { fmtDateTime, fmtNum } from "@/lib/domain/labels";
import { EmptyState, ErrorState, LoadingState } from "./ui-bits";

const timeLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const colors = { rapid: "#d9526c", basal: "#168779" };

export function InsulinActionChart() {
  const { mode } = usePatientStore();
  const admins = useAdministrations(200);
  const catalog = useCatalog();
  const [hours, setHours] = useState(24);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const from = now - hours * 1800000,
    to = now + hours * 1800000;
  const applications = demoActionApplications(admins.data ?? [], catalog.data ?? [])
    .filter((a) => a.start <= to && a.end > from)
    .sort((a, b) => b.start - a.start);
  const active = applications.filter((a) => a.start <= now && a.end > now);
  const data = demoActionSeries(applications, from, to);
  const unknown = (admins.data ?? []).filter(
    (a) =>
      a.status === "performed" &&
      a.confirmed_by_user &&
      !a.is_superseded &&
      new Date(a.administered_at).getTime() >= from &&
      !catalog.data?.some(
        (c) => c.id === a.insulin_id && ["fiasp", "lantus"].includes(c.brand_name.toLowerCase()),
      ),
  );

  return (
    <section className="insulin-action-section" aria-labelledby="insulin-action-title">
      <div className="chart-toolbar">
        <div>
          <h2 id="insulin-action-title" className="flex items-center gap-2">
            <Syringe size={17} aria-hidden /> Insulinas em ação
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {active.length} aplicações na janela de ação ilustrativa ·{" "}
            {mode === "demo"
              ? "dados de demonstração"
              : "registros confirmados, perfil ilustrativo; não representa insulina restante"}
          </p>
        </div>
        <div
          className="period-control"
          role="radiogroup"
          aria-label="Janela do gráfico de insulina"
        >
          {[12, 24, 48].map((h) => (
            <button key={h} role="radio" aria-checked={hours === h} onClick={() => setHours(h)}>
              {h} h
            </button>
          ))}
        </div>
      </div>
      {admins.error || catalog.error ? (
        <ErrorState error={admins.error ?? catalog.error} />
      ) : admins.isLoading || catalog.isLoading ? (
        <LoadingState />
      ) : !applications.length ? (
        <EmptyState title="Nenhuma aplicação confirmada com perfil disponível">
          <Link to="/monitor/insulina" className="text-primary">
            Ver aplicações pendentes
          </Link>
        </EmptyState>
      ) : (
        <div className="insulin-action-layout">
          <div className="min-w-0">
            <div className="insulin-action-legend">
              <span>
                <i style={{ background: colors.rapid }} />
                Fiasp · rápida
              </span>
              <span>
                <i style={{ background: colors.basal }} />
                Lantus · basal
              </span>
              <span>Perfil relativo (%)</span>
            </div>
            <div
              className="insulin-action-canvas"
              role="img"
              aria-label="Perfis ilustrativos de ação relativa, aplicações e picos de Fiasp e Lantus. Não representa unidades de insulina restantes."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 24, right: 16, bottom: 12, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={[from, to]}
                    tickFormatter={timeLabel}
                    tickCount={5}
                    minTickGap={32}
                    axisLine={false}
                    tickLine={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    domain={[0, 105]}
                    ticks={[0, 50, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <ReferenceLine
                    x={now}
                    stroke="var(--foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Agora",
                      position: "top",
                      fill: "var(--muted-foreground)",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active: hovered, payload, label }) =>
                      hovered && payload?.length ? (
                        <div className="insulin-chart-tooltip">
                          <strong>{fmtDateTime(new Date(Number(label)).toISOString())}</strong>
                          {payload
                            .filter((p) => Number(p.value) > 0)
                            .map((p) => (
                              <p key={String(p.dataKey)} style={{ color: p.color }}>
                                {p.name}: {fmtNum(Number(p.value), 0)}%
                              </p>
                            ))}
                          <p className="text-muted-foreground">Ação relativa ilustrativa</p>
                        </div>
                      ) : null
                    }
                  />
                  {applications.map((a, index) => (
                    <Line
                      key={a.administration.id}
                      dataKey={a.administration.id}
                      name={`${a.profile.name} ${fmtNum(a.administration.dose_units, 2)} UI · ${timeLabel(a.start)}`}
                      type="linear"
                      stroke={colors[a.profile.role]}
                      strokeWidth={2.2}
                      strokeDasharray={index % 2 ? "5 3" : undefined}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {applications
                    .filter((a) => a.start >= from)
                    .map((a) => (
                      <ReferenceLine
                        key={`start-${a.administration.id}`}
                        x={a.start}
                        stroke={colors[a.profile.role]}
                        strokeOpacity={0.3}
                        strokeDasharray="2 5"
                      />
                    ))}
                  {applications
                    .filter((a) => a.peak != null && a.peak >= from && a.peak <= to)
                    .map((a) => (
                      <ReferenceDot
                        key={`peak-${a.administration.id}`}
                        x={a.peak!}
                        y={100}
                        r={4}
                        fill={colors[a.profile.role]}
                        stroke="var(--background)"
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Curvas normalizadas por aplicação, não somadas. Os pontos marcam picos ilustrativos da
              Fiasp; a Lantus não tem pico pronunciado. Não é cálculo de insulina restante (IOB).
            </p>
          </div>
          <ul className="insulin-action-list" aria-label="Aplicações e janelas de ação">
            {applications.map((a) => (
              <li key={a.administration.id}>
                <div className="flex items-center justify-between gap-2">
                  <strong style={{ color: colors[a.profile.role] }}>
                    {a.profile.name} · {fmtNum(a.administration.dose_units, 2)} UI
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {a.start > now
                      ? "Horário futuro"
                      : a.end <= now
                        ? "Janela encerrada"
                        : "Na janela de ação"}
                  </span>
                </div>
                <p>Aplicação · {fmtDateTime(a.administration.administered_at)}</p>
                <p>
                  {a.peak == null
                    ? "Sem pico pronunciado"
                    : `Pico ilustrativo · ${fmtDateTime(new Date(a.peak).toISOString())}`}
                </p>
                <p>Fim ilustrativo · {fmtDateTime(new Date(a.end).toISOString())}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!unknown.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          {unknown.length} aplicação(ões) de outras insulinas sem perfil ilustrativo; não foi
          estimada uma curva.
        </p>
      )}
      <details className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold">Perfis e referências</summary>
        <div className="insulin-profile-references">
          {Object.values(DEMO_INSULIN_PROFILES).map((p) => (
            <div key={p.name}>
              <strong className="text-foreground">{p.name}</strong>
              <p>
                Início: {p.onsetText} · Pico: {p.peakText} · Duração: {p.durationText}
              </p>
              <a
                href={p.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary"
              >
                {p.sourceLabel}
                <ExternalLink size={12} aria-hidden />
              </a>
            </div>
          ))}
          <p>
            A Fiasp usa marcos de 17 min, 122 min e 6 h do estudo de 0,2 UI/kg apenas para desenhar
            o perfil. As rampas da Lantus são ilustrativas. Dose, pessoa e local da aplicação
            alteram a ação real. O esquema de Lantus 18 UI às 07h e 12 UI às 22h é fictício; a bula
            descreve uso uma vez ao dia.
          </p>
        </div>
      </details>
    </section>
  );
}
