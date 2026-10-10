import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ClinicalSettings,
  GlucoseReading,
  InsulinAdministration,
  KetoneReading,
  MealEntry,
} from "@/lib/domain/types";
import { chartReadings } from "@/lib/glucose/chart-data";
import { SOURCE_LABEL } from "@/lib/domain/labels";

interface Props {
  readings: GlucoseReading[];
  settings: ClinicalSettings;
  meals: MealEntry[];
  admins: InsulinAdministration[];
  ketones: KetoneReading[];
  hours: number;
}

export function GlucoseChart({ readings, settings, meals, admins, ketones, hours }: Props) {
  const now = Date.now();
  const from = now - hours * 3600000;
  const { auto, manual, valid } = chartReadings(readings, from, now);
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from && t <= now;
  };
  const yMax =
    Math.ceil(
      Math.max(250, settings.target_high_mgdl + 40, ...valid.map((r) => r.value_mgdl + 30)) / 50,
    ) * 50;
  const yMin = Math.max(
    0,
    Math.min(40, settings.target_low_mgdl - 20, ...valid.map((r) => r.value_mgdl - 10)),
  );
  const fmt = (t: number) =>
    new Date(t).toLocaleString(
      "pt-BR",
      hours > 24 ? { day: "2-digit", month: "2-digit" } : { hour: "2-digit", minute: "2-digit" },
    );
  const ticks = Array.from({ length: 5 }, (_, i) => from + ((now - from) * i) / 4);
  const yStep = yMax > 400 ? 100 : 50;
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep).filter(
    (n) => n >= yMin,
  );
  const autoSource = valid.find((r) => r.source !== "manual")?.source;
  return (
    <figure aria-label={`Gráfico de glicemia das últimas ${hours} horas`}>
      <div className="glucose-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={auto}
            margin={{ top: 12, right: 14, left: -20, bottom: 2 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[from, now]}
              ticks={ticks}
              tickFormatter={fmt}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              scale="time"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={24}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <ReferenceArea
              y1={settings.target_low_mgdl}
              y2={settings.target_high_mgdl}
              fill="var(--success)"
              fillOpacity={0.07}
            />
            <ReferenceLine
              y={settings.target_low_mgdl}
              stroke="var(--success)"
              strokeOpacity={0.25}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={settings.target_high_mgdl}
              stroke="var(--success)"
              strokeOpacity={0.25}
              strokeDasharray="4 4"
            />
            {meals
              .filter((m) => inRange(m.eaten_at))
              .map((m) => (
                <ReferenceLine
                  key={m.id}
                  x={new Date(m.eaten_at).getTime()}
                  stroke="var(--warning)"
                  strokeOpacity={0.6}
                  strokeDasharray="3 5"
                />
              ))}
            {admins
              .filter(
                (a) => !a.is_superseded && a.status === "performed" && inRange(a.administered_at),
              )
              .map((a) => (
                <ReferenceLine
                  key={a.id}
                  x={new Date(a.administered_at).getTime()}
                  stroke="var(--info)"
                  strokeOpacity={0.45}
                  strokeDasharray="3 5"
                />
              ))}
            {ketones
              .filter((k) => inRange(k.measured_at))
              .map((k) => (
                <ReferenceLine
                  key={k.id}
                  x={new Date(k.measured_at).getTime()}
                  stroke="var(--destructive)"
                  strokeOpacity={0.4}
                  strokeDasharray="1 5"
                />
              ))}
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.some((p) => p.value != null) ? (
                  <div className="chart-tooltip">
                    <time>{new Date(Number(label)).toLocaleString("pt-BR")}</time>
                    {payload
                      .filter((p) => p.value != null)
                      .map((p) => (
                        <strong key={String(p.dataKey)}>
                          {p.value}{" "}
                          <span className="text-xs font-normal">
                            mg/dL{p.dataKey === "m" ? " · Manual" : ""}
                          </span>
                        </strong>
                      ))}
                  </div>
                ) : null
              }
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            />
            <Line
              dataKey="v"
              type="linear"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Scatter
              data={manual}
              dataKey="m"
              fill="var(--info)"
              shape="diamond"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-legend">
        <span>
          <i />
          {autoSource ? SOURCE_LABEL[autoSource] : "Sem dados automáticos"}
        </span>
        <span>
          <i style={{ background: "var(--success)", opacity: 0.4 }} />
          Alvo {settings.target_low_mgdl}–{settings.target_high_mgdl}
        </span>
        <span>
          <i style={{ background: "var(--warning)" }} />
          Refeição
        </span>
        <span>
          <i style={{ background: "var(--info)" }} />
          Insulina / manual
        </span>
        {ketones.some((k) => inRange(k.measured_at)) && (
          <span>
            <i style={{ background: "var(--destructive)" }} />
            Cetona
          </span>
        )}
      </figcaption>
    </figure>
  );
}
