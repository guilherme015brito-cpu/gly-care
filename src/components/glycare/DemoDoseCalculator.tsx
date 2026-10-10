import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, RotateCcw, Settings2 } from "lucide-react";
import { useGlucose, useSettings } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import {
  calculateDemoDose,
  calculateDemoCorrection,
  decimal,
  demoParameters,
  demoCorrectionParameters,
} from "@/lib/demo-dose";
import type { GlucoseReading } from "@/lib/domain/types";
import { fmtDateTime, fmtNum } from "@/lib/domain/labels";
import { Input } from "@/components/ui/input";
import { Field, inputCls } from "./form";
import { ErrorState, LoadingState } from "./ui-bits";

interface Props {
  kind?: "meal" | "correction";
  carbs?: number | null;
  at: string;
  complete?: boolean;
  reading?: GlucoseReading | undefined;
  followMonitor?: boolean;
}

export function DemoMealDoseCalculator(props: Pick<Props, "carbs" | "at" | "complete">) {
  const glucose = useGlucose(24);
  const reading = glucose.data?.filter((r) => r.quality !== "invalid").at(-1);
  return <DemoDoseCalculator {...props} reading={reading} followMonitor />;
}

export function DemoDoseCalculator({
  kind = "meal",
  carbs = 0,
  at,
  complete = true,
  reading,
  followMonitor = false,
}: Props) {
  const { mode } = usePatientStore();
  const settings = useSettings();
  const [glucoseOverride, setGlucoseOverride] = useState<string | null>(null);
  const [increment, setIncrement] = useState(0.5);
  if (mode !== "demo") return null;
  const correctionOnly = kind === "correction";
  const glucose =
    glucoseOverride ??
    (correctionOnly || followMonitor ? (reading ? String(reading.value_mgdl) : "") : "180");
  const parameters = settings.data
    ? correctionOnly
      ? demoCorrectionParameters(settings.data)
      : demoParameters(settings.data, new Date(at))
    : null;
  const result =
    complete && parameters && !("error" in parameters)
      ? parameters.kind === "meal"
        ? calculateDemoDose(
            carbs,
            decimal(glucose),
            parameters.target,
            parameters.sensitivity,
            parameters.ratio,
            increment,
          )
        : calculateDemoCorrection(
            decimal(glucose),
            parameters.target,
            parameters.sensitivity,
            increment,
          )
      : null;
  const id = correctionOnly ? "correction" : "demo";
  return (
    <section
      className={correctionOnly ? "dose-simulation correction-simulation" : "dose-simulation"}
      aria-labelledby={id + "-dose-title"}
    >
      <div className="section-heading">
        <h2 id={id + "-dose-title"} className="flex items-center gap-2">
          <Calculator size={17} aria-hidden />
          {correctionOnly ? "Calculadora de correção" : "Calculadora da refeição"}
        </h2>
        <Link
          to="/config/paciente"
          title="Parâmetros da simulação"
          aria-label="Parâmetros da simulação"
        >
          <Settings2 size={17} />
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Simulação com dados fictícios ·{" "}
        {correctionOnly ? "correção de glicemia" : "refeição + correção de glicemia"}
      </p>
      {settings.error ? (
        <ErrorState error={settings.error} />
      ) : !parameters ? (
        <LoadingState />
      ) : "error" in parameters ? (
        <p role="status" className="text-sm text-warning-foreground">
          {parameters.error}
        </p>
      ) : (
        <div className={correctionOnly ? "correction-layout" : undefined}>
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                id={id + "-glucose"}
                label={correctionOnly ? "Glicemia simulada (mg/dL)" : "Glicemia fictícia (mg/dL)"}
              >
                <Input
                  id={id + "-glucose"}
                  inputMode="decimal"
                  className={inputCls}
                  value={glucose}
                  onChange={(e) => setGlucoseOverride(e.target.value)}
                />
              </Field>
              <Field id={id + "-rounding"} label="Arredondamento (UI)">
                <select
                  id={id + "-rounding"}
                  className="h-12 w-full rounded-md border bg-card px-3"
                  value={increment}
                  onChange={(e) => setIncrement(Number(e.target.value))}
                >
                  <option value={0}>Sem arredondamento</option>
                  <option value={0.1}>0,1 UI</option>
                  <option value={0.5}>0,5 UI</option>
                  <option value={1}>1 UI</option>
                </select>
              </Field>
            </div>
            {(correctionOnly || followMonitor) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {glucoseOverride === null && reading
                    ? "Leitura do monitor · " + fmtDateTime(reading.measured_at)
                    : "Cenário demonstrativo editado"}
                </p>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50"
                  disabled={!reading}
                  onClick={() => setGlucoseOverride(null)}
                >
                  <RotateCcw size={12} aria-hidden />
                  Usar leitura do monitor
                </button>
              </div>
            )}
          </div>
          <div>
            <div className="dose-result" aria-live="polite">
              <div>
                <p className="text-sm font-semibold">Resultado demonstrativo</p>
                <p className="text-xs text-muted-foreground">
                  {parameters.kind === "meal"
                    ? parameters.band.from +
                      "–" +
                      parameters.band.to +
                      " · 1 UI : " +
                      fmtNum(parameters.ratio) +
                      " g"
                    : "Alvo " +
                      fmtNum(parameters.target) +
                      " mg/dL · sensibilidade " +
                      fmtNum(parameters.sensitivity) +
                      " mg/dL/UI"}
                </p>
              </div>
              <strong>
                {result ? fmtNum(result.rounded, 2) : "—"}{" "}
                <span className="text-sm font-medium">UI</span>
              </strong>
            </div>
            {result ? (
              <dl className="dose-breakdown">
                {parameters.kind === "meal" && (
                  <div>
                    <dt>
                      Refeição: {fmtNum(carbs!)} ÷ {fmtNum(parameters.ratio)}
                    </dt>
                    <dd>{fmtNum(result.meal, 2)} UI</dd>
                  </div>
                )}
                <div>
                  <dt>
                    Correção: máx(0, ({glucose} − {parameters.target}) ÷ {parameters.sensitivity})
                  </dt>
                  <dd>{fmtNum(result.correction, 2)} UI</dd>
                </div>
                <div className="border-t pt-2">
                  <dt>Total antes do arredondamento</dt>
                  <dd>{fmtNum(result.total, 2)} UI</dd>
                </div>
              </dl>
            ) : (
              <p role="status" className="text-xs text-muted-foreground">
                {!complete
                  ? "Adicione os alimentos e preencha todas as porções para simular."
                  : "Preencha uma glicemia numérica e não negativa para simular."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
