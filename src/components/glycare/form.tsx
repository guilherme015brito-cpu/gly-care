import type { ReactNode } from "react";
import type { ZodError } from "zod";
import { Label } from "@/components/ui/label";
import { FieldError } from "./ui-bits";
import { cn } from "@/lib/utils";

export type Errors = Record<string, string>;

export function zodErrors(e: ZodError): Errors {
  const out: Errors = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export function Field({ id, label, hint, error, children, optional }: { id: string; label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode; optional?: boolean | undefined }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1">{children}</div>
      <FieldError msg={error} id={`${id}-err`} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, cols }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string; cols?: number }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-lg px-2 text-sm font-semibold", value === o.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "h-12 text-base";
export const selectCls = "h-12 w-full rounded-md border border-input bg-card px-3 text-base";
