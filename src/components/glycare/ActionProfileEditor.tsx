import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import type { InsulinActionProfile, InsulinCatalogItem } from "@/lib/domain/types";
import { insulinCatalogSchema } from "@/lib/validation";
import { REFERENCE_PRESETS, visualProfileSchema } from "@/lib/insulin/config";
import { useStoreMutation } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, inputCls, selectCls } from "./form";
import { ErrorState } from "./ui-bits";

export function ActionProfileEditor({
  item,
  profile,
}: {
  item: InsulinCatalogItem;
  profile?: InsulinActionProfile | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"rapid" | "basal">(profile?.visual_profile?.role ?? "rapid");
  const [onset, setOnset] = useState(String(profile?.visual_profile?.onsetMinutes ?? ""));
  const [peak, setPeak] = useState(String(profile?.visual_profile?.peakMinutes ?? ""));
  const [duration, setDuration] = useState(String(profile?.visual_profile?.durationMinutes ?? ""));
  const [source, setSource] = useState(profile?.source_reference ?? "");
  const [error, setError] = useState("");
  const save = useStoreMutation(
    async (s, _pid, v: ReturnType<typeof insulinCatalogSchema.parse>) => {
      if (!s.saveActionProfile) throw new Error("Edicao indisponivel.");
      await s.saveActionProfile(item.id, v);
    },
    "Perfil ilustrativo atualizado",
  );
  const [texts, setTexts] = useState({
    onset_text: profile?.onset_text ?? "",
    peak_text: profile?.peak_text ?? "",
    effective_duration_text: profile?.effective_duration_text ?? "",
    max_duration_text: profile?.max_duration_text ?? "",
  });
  const brand = item.brand_name.trim().toLowerCase();
  const isU100 = /^(u-?100|100\s*(ui|u)\s*\/\s*ml)$/i.test(item.concentration?.trim() ?? "");
  function openEditor() {
    setRole(profile?.visual_profile?.role ?? "rapid");
    setOnset(String(profile?.visual_profile?.onsetMinutes ?? ""));
    setPeak(String(profile?.visual_profile?.peakMinutes ?? ""));
    setDuration(String(profile?.visual_profile?.durationMinutes ?? ""));
    setSource(profile?.source_reference ?? "");
    setTexts({
      onset_text: profile?.onset_text ?? "",
      peak_text: profile?.peak_text ?? "",
      effective_duration_text: profile?.effective_duration_text ?? "",
      max_duration_text: profile?.max_duration_text ?? "",
    });
    setError("");
    setOpen(true);
  }
  function preset(key: keyof typeof REFERENCE_PRESETS) {
    const p = REFERENCE_PRESETS[key];
    setRole(p.visual_profile.role);
    setOnset(String(p.visual_profile.onsetMinutes));
    setPeak(String(p.visual_profile.peakMinutes ?? ""));
    setDuration(String(p.visual_profile.durationMinutes));
    setSource(p.source_reference);
    setTexts(p);
  }
  function submit() {
    const visual = visualProfileSchema.safeParse({
      role,
      onsetMinutes: onset.trim() ? Number(onset.replace(",", ".")) : NaN,
      peakMinutes: role === "basal" ? null : peak.trim() ? Number(peak.replace(",", ".")) : NaN,
      durationMinutes: duration.trim() ? Number(duration.replace(",", ".")) : NaN,
    });
    if (!visual.success || !/^https:\/\//.test(source))
      return setError("Confira os minutos e informe o link HTTPS da fonte oficial.");
    const input = insulinCatalogSchema.parse({
      brand_name: item.brand_name,
      ...texts,
      source_reference: source,
      source_review_date: new Date().toISOString().slice(0, 10),
      validation_status: "under_review",
      visual_profile: visual.data,
    });
    setError("");
    save.mutate(input, { onSuccess: () => setOpen(false) });
  }
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={openEditor}>
        <Pencil aria-hidden />
        Editar perfil do grafico
      </Button>
    );
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        {brand === "fiasp" && isU100 && (
          <Button size="sm" variant="outline" onClick={() => preset("fiasp")}>
            Referencia Fiasp U-100
          </Button>
        )}
        {brand === "lantus" && isU100 && (
          <Button size="sm" variant="outline" onClick={() => preset("lantus")}>
            Referencia Lantus U-100
          </Button>
        )}
      </div>
      <Field id={`role-${item.id}`} label="Perfil ilustrativo">
        <select
          id={`role-${item.id}`}
          className={selectCls}
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="rapid">Prandial com pico</option>
          <option value="basal">Basal sem pico pronunciado</option>
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Inicio / rampa (min)", onset, setOnset],
          ["Pico ilustrativo (min)", peak, setPeak],
          ["Janela ilustrativa (min)", duration, setDuration],
        ].map(([label, value, set], i) => (
          <Field key={i} id={`p-${item.id}-${i}`} label={String(label)}>
            <Input
              id={`p-${item.id}-${i}`}
              className={inputCls}
              inputMode="decimal"
              disabled={i === 1 && role === "basal"}
              value={String(value)}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
            />
          </Field>
        ))}
      </div>
      <Field id={`source-${item.id}`} label="Fonte oficial">
        <Input
          id={`source-${item.id}`}
          value={source}
          className={inputCls}
          onChange={(e) => setSource(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Marcos para desenhar a curva, nao tempos medidos no paciente nem insulina restante.
      </p>
      {error && <p role="alert">{error}</p>}
      {save.error && <ErrorState error={save.error} />}
      <Button disabled={save.isPending} onClick={submit}>
        <Save aria-hidden />
        Salvar perfil
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
