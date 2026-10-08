import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { ClinicalSettings, GlucoseReading, InsulinAdministration, KetoneReading, MealEntry } from "@/lib/domain/types";
import { CHART_GAP_MIN } from "@/lib/glucose/status";
import { SOURCE_LABEL } from "@/lib/domain/labels";

interface Props {
  readings: GlucoseReading[];
  settings: ClinicalSettings;
  meals: MealEntry[];
  admins: InsulinAdministration[];
  ketones: KetoneReading[];
  hours: number;
}

/**
 * Line breaks (null point) are inserted where readings are missing for longer
 * than CHART_GAP_MIN — no intermediate values are invented.
 */
export function GlucoseChart({ readings, settings, meals, admins, ketones, hours }: Props) {
  const from = Date.now() - hours * 3600000;
  const auto: Array<{ t: number; v: number | null }> = [];
  let prev: number | null = null;
  for (const r of readings.filter((x) => x.source !== "manual")) {
    const t = new Date(r.measured_at).getTime();
    if (prev != null && t - prev > CHART_GAP_MIN * 60000) auto.push({ t: prev + 1, v: null });
    auto.push({ t, v: r.value_mgdl });
    prev = t;
  }
  const manual = readings.filter((x) => x.source === "manual").map((r) => ({ t: new Date(r.measured_at).getTime(), m: r.value_mgdl }));
  const inRange = (iso: string) => new Date(iso).getTime() >= from;
  const yMax = Math.max(300, ...readings.map((r) => r.value_mgdl + 20));
  const fmt = (t: number) => new Date(t).toLocaleString("pt-BR", hours > 24 ? { day: "2-digit", month: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
  const autoSource = readings.find((r) => r.source !== "manual")?.source;

  return (
    <figure aria-label={`Gráfico de glicemia das últimas ${hours} horas`}>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="t" type="number" domain={[from, Date.now()]} tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} scale="time" />
            <YAxis domain={[40, yMax]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            <ReferenceArea y1={settings.target_low_mgdl} y2={settings.target_high_mgdl} fill="var(--color-success)" fillOpacity={0.1} />
            {meals.filter((m) => inRange(m.eaten_at)).map((m) => (
              <ReferenceLine key={m.id} x={new Date(m.eaten_at).getTime()} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: "R", position: "top", fontSize: 11, fill: "var(--color-warning)" }} />
            ))}
            {admins.filter((a) => !a.is_superseded && a.status === "performed" && inRange(a.administered_at)).map((a) => (
              <ReferenceLine key={a.id} x={new Date(a.administered_at).getTime()} stroke="var(--color-info)" label={{ value: `I ${a.dose_units}`, position: "insideTopRight", fontSize: 10, fill: "var(--color-info)" }} />
            ))}
            {ketones.filter((k) => inRange(k.measured_at)).map((k) => (
              <ReferenceLine key={k.id} x={new Date(k.measured_at).getTime()} stroke="var(--color-destructive)" strokeDasharray="1 3" label={{ value: "C", position: "top", fontSize: 11, fill: "var(--color-destructive)" }} />
            ))}
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString("pt-BR")} formatter={(v) => [`${v} mg/dL`, "Glicemia"]} contentStyle={{ borderRadius: 12, background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
            <Line data={auto} dataKey="v" type="monotone" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Scatter data={manual} dataKey="m" fill="var(--color-info)" shape="diamond" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>— Linha: {autoSource ? SOURCE_LABEL[autoSource] : "sem dados automáticos"}</span>
        <span>◆ Manual</span>
        <span>R Refeição</span>
        <span>I Insulina (UI)</span>
        <span>C Cetona</span>
        <span>Faixa verde: alvo {settings.target_low_mgdl}–{settings.target_high_mgdl}</span>
      </figcaption>
    </figure>
  );
}
