import { Plus, Trash2 } from "lucide-react";
import type { CarbRatio, MealType } from "@/lib/domain/types";
import { MEAL_LABEL } from "@/lib/domain/labels";
import { carbsPerUnit } from "@/lib/dose-periods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./form";

interface Props {
  periods: CarbRatio[];
  onChange: (periods: CarbRatio[]) => void;
  error?: string | undefined;
}

export function DosePeriodsEditor({ periods, onChange, error }: Props) {
  function change(index: number, patch: Partial<CarbRatio>) {
    onChange(periods.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  return (
    <section aria-labelledby="dose-periods-title">
      <h3 id="dose-periods-title" className="text-sm font-semibold">
        Fatores por refeição e horário
      </h3>
      <ul className="mt-2 divide-y divide-border">
        {periods.map((p, i) => (
          <li key={i} className="space-y-3 py-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field id={`period-meal-${i}`} label="Refeição">
                  <select
                    id={`period-meal-${i}`}
                    aria-label={`Refeição da faixa ${i + 1}`}
                    value={p.meal_type ?? ""}
                    onChange={(e) =>
                      change(i, {
                        meal_type: e.target.value ? (e.target.value as MealType) : undefined,
                      })
                    }
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Faixa por horário</option>
                    {Object.entries(MEAL_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Remover faixa"
                aria-label={`Remover faixa ${i + 1}`}
                className="h-11 w-11 shrink-0 text-destructive"
                onClick={() => onChange(periods.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`period-from-${i}`} label="Início">
                <Input
                  id={`period-from-${i}`}
                  type="time"
                  aria-label={`Início da faixa ${i + 1}`}
                  value={p.from}
                  className="h-11 min-w-0"
                  onChange={(e) => change(i, { from: e.target.value })}
                />
              </Field>
              <Field id={`period-to-${i}`} label="Fim">
                <Input
                  id={`period-to-${i}`}
                  type="time"
                  aria-label={`Fim da faixa ${i + 1}`}
                  value={p.to}
                  className="h-11 min-w-0"
                  onChange={(e) => change(i, { to: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`period-sensitivity-${i}`} label="Sensibilidade (mg/dL por UI)">
                <Input
                  id={`period-sensitivity-${i}`}
                  inputMode="decimal"
                  aria-label={`Sensibilidade da faixa ${i + 1}`}
                  value={p.sensitivity_text ?? ""}
                  placeholder={p.sensitivity_text === undefined ? "Padrão" : undefined}
                  className="h-11"
                  maxLength={60}
                  onChange={(e) => change(i, { sensitivity_text: e.target.value })}
                />
              </Field>
              <Field id={`period-carbs-${i}`} label="Carboidratos (g por UI)">
                <Input
                  id={`period-carbs-${i}`}
                  inputMode="decimal"
                  aria-label={`Carboidratos da faixa ${i + 1}`}
                  value={carbsPerUnit(p.ratio_text) ?? p.ratio_text}
                  className="h-11"
                  maxLength={60}
                  onChange={(e) => change(i, { ratio_text: e.target.value })}
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="soft"
        size="sm"
        className="mt-2"
        onClick={() =>
          onChange([...periods, { from: "", to: "", ratio_text: "", sensitivity_text: "" }])
        }
      >
        <Plus size={16} /> Adicionar faixa
      </Button>
    </section>
  );
}
