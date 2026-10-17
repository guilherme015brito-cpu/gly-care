import { useQuery } from "@tanstack/react-query";
import { usePatientStore } from "@/lib/app-context";
import { INJECTION_SITES, siteRotation } from "@/lib/injection-sites";
import { Field, selectCls } from "./form";
import { ErrorState } from "./ui-bits";

export function InjectionSiteField({
  value,
  onChange,
  at,
  excludeId,
  error,
  disabled,
  id = "injection-site",
}: {
  value: string;
  onChange: (site: string) => void;
  at: string;
  excludeId?: string | undefined;
  error?: string | undefined;
  disabled?: boolean;
  id?: string;
}) {
  const { store, pid, key } = usePatientStore();
  const validTime = Number.isFinite(Date.parse(at));
  const context = useQuery({
    queryKey: [...key, "injection-context", at, excludeId],
    queryFn: () => store.getInjectionContext(pid, new Date(at).toISOString(), excludeId),
    enabled: validTime,
  });
  const state = context.data ? siteRotation(context.data, value) : null;
  return (
    <div className="space-y-2">
      <Field id={id} label="Local da aplicação" error={error}>
        <select
          id={id}
          required
          value={value}
          className={selectCls}
          disabled={disabled || context.isLoading || !!context.error || !validTime}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || state?.blocked}
        >
          <option value="">Selecione o local…</option>
          {INJECTION_SITES.map((site) => {
            const blocked = context.data && siteRotation(context.data, site).blocked;
            return (
              <option key={site} value={site} disabled={!!blocked}>
                {site}
                {blocked ? " — bloqueado pelo rodízio" : ""}
              </option>
            );
          })}
        </select>
      </Field>
      {context.error && <ErrorState error={context.error} />}
      {state?.blocked ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-destructive">
          Esta região completaria quatro aplicações consecutivas. Selecione outro local.
        </p>
      ) : state?.repeated ? (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
          Local repetido: {state.previous} aplicação(ões) consecutiva(s) nesta região. Faça o
          rodízio e prefira outro local conforme sua orientação de cuidado.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Após três aplicações consecutivas na mesma região, escolha outra. O rodízio dos pontos
        dentro de cada região também deve seguir sua orientação de cuidado.
      </p>
    </div>
  );
}
