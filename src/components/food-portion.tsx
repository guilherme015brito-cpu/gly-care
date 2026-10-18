import { useId, useState } from "react";
import type { Food } from "@/lib/domain/types";
import { foodMeasures, measureGrams } from "@/lib/food-measures";
import { PORTION_UNITS, type PortionUnit } from "@/lib/portion-units";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** A weight override belongs to this food snapshot, never to the shared TACO catalog. */
export function FoodPortion({
  food,
  measure,
  quantity,
  disabled,
  onChange,
}: {
  food: Food;
  measure: string;
  quantity: string;
  disabled?: boolean;
  onChange: (food: Food) => void;
}) {
  const id = useId();
  const [unit, setUnit] = useState<PortionUnit>(
    (food.portion_unit && !["g", "ml"].includes(food.portion_unit)
      ? food.portion_unit
      : undefined) ?? (food.name.startsWith("Iogurte") ? "concha" : "un"),
  );
  const [weight, setWeight] = useState("");
  const selected = foodMeasures(food).find((m) => m.id === measure);
  const grams = measureGrams(food, quantity, measure);
  const mass = /^\d{1,4}([.,]\d{1,2})?$/.test(weight) ? Number(weight.replace(",", ".")) : NaN;
  const valid = Number.isFinite(mass) && mass > 0 && mass <= 5000;
  return (
    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
      {measure !== "g" && selected && (
        <p>
          {Number.isFinite(grams)
            ? `${grams.toLocaleString("pt-BR")} g no total · `
            : "Informe a quantidade · "}
          {selected.sourceUrl ? (
            <a
              className="underline underline-offset-2"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {selected.source}
            </a>
          ) : (
            selected.source
          )}
        </p>
      )}
      {!disabled && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium text-foreground">
            Personalizar medida
          </summary>
          <p className="mt-2">
            Use o peso medido ou do rótulo, sem casca, caroço ou osso. A medida aplicada fica salva
            neste item; os nutrientes por 100 g são mantidos.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label htmlFor={`${id}-unit`}>
              Medida personalizada
              <select
                id={`${id}-unit`}
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={unit}
                onChange={(e) => setUnit(e.target.value as PortionUnit)}
              >
                {Object.entries(PORTION_UNITS)
                  .filter(([key]) => key !== "g" && key !== "ml")
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor={`${id}-weight`}>
              Peso de 1 medida (g)
              <Input
                id={`${id}-weight`}
                className="mt-1 h-11 text-foreground"
                inputMode="decimal"
                placeholder="Ex.: 80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                aria-invalid={weight !== "" && !valid}
              />
            </label>
          </div>
          {weight !== "" && !valid && (
            <p role="alert" className="mt-2 text-destructive">
              Informe um peso maior que zero, até 5.000 g.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={!valid}
            onClick={() =>
              onChange({ ...food, portion_amount: 1, portion_unit: unit, portion_grams: mass })
            }
          >
            Aplicar medida
          </Button>
        </details>
      )}
    </div>
  );
}
