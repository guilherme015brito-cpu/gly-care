import { describe, expect, it } from "vitest";
import { computeItem, nutrientFor, sumItems } from "@/lib/nutrition";
import { administrationSchema, findPossibleDuplicates, ketoneSchema, manualGlucoseSchema, foodImportRowSchema } from "@/lib/validation";
import { filterNewReadings, MockGlucoseProvider } from "@/lib/glucose/providers";
import { classifyGlucose, toMgdl } from "@/lib/glucose/status";
import type { Food } from "@/lib/domain/types";

const food = (o: Partial<Food> = {}): Food => ({ id: "f", patient_id: null, name: "X", preparation: null, state: "cooked", source: "manual", source_reference: null, carbs_per_100g: 30, protein_per_100g: 2.5, fat_per_100g: null, kcal_per_100g: 130, edible_portion_pct: 100, is_favorite: false, ...o });

describe("nutrição", () => {
  it("calcula por 100 g × gramas", () => expect(nutrientFor(30, 150)).toBe(45));
  it("não inventa valor ausente", () => expect(nutrientFor(null, 150)).toBeNull());
  it("aplica parte comestível só quando o peso inclui partes não comestíveis", () => {
    expect(computeItem(food({ edible_portion_pct: 60 }), 100, true).carbs_g).toBe(18);
    expect(computeItem(food({ edible_portion_pct: 60 }), 100, false).carbs_g).toBe(30);
  });
  it("soma vários itens e marca nutriente ausente como null", () => {
    const t = sumItems([computeItem(food(), 100), computeItem(food({ carbs_per_100g: 14 }), 50)]);
    expect(t.carbs_g).toBe(37);
    expect(t.fat_g).toBeNull();
    expect(t.hasMissing).toBe(true);
  });
});

describe("validação de insulina", () => {
  const base = { insulin_id: "i", dose: "4,5", administered_at: "2020-01-01T10:00", purpose: "meal" as const, status: "performed" as const, confirmed: true };
  it("aceita vírgula decimal", () => expect(administrationSchema.parse(base).dose).toBe(4.5));
  it("rejeita dose negativa", () => expect(administrationSchema.safeParse({ ...base, dose: "-2" }).success).toBe(false));
  it("rejeita texto não numérico", () => expect(administrationSchema.safeParse({ ...base, dose: "4u" }).success).toBe(false));
  it("rejeita zero", () => expect(administrationSchema.safeParse({ ...base, dose: "0" }).success).toBe(false));
  it("exige confirmação para aplicação realizada", () => expect(administrationSchema.safeParse({ ...base, confirmed: false }).success).toBe(false));
  it("planejada não exige confirmação", () => expect(administrationSchema.safeParse({ ...base, status: "planned", confirmed: false }).success).toBe(true));
  it("avisa duplicidade dentro de 30 min sem bloquear", () => {
    const ex = [{ insulin_id: "i", administered_at: "2020-01-01T10:10:00Z", status: "performed", is_superseded: false }];
    expect(findPossibleDuplicates(ex, { insulin_id: "i", administered_at: "2020-01-01T10:00:00Z" })).toHaveLength(1);
    expect(findPossibleDuplicates(ex, { insulin_id: "i", administered_at: "2020-01-01T12:00:00Z" })).toHaveLength(0);
  });
});

describe("glicemia e cetonas", () => {
  it("valor incompatível com unidade é rejeitado", () => {
    expect(manualGlucoseSchema.safeParse({ value: "120", unit: "mmol/L", measured_at: "2020-01-01T10:00" }).success).toBe(false);
    expect(manualGlucoseSchema.safeParse({ value: "6,5", unit: "mmol/L", measured_at: "2020-01-01T10:00" }).success).toBe(true);
  });
  it("converte mmol/L preservando o original", () => expect(toMgdl(5.5, "mmol/L")).toBeCloseTo(99.1, 1));
  it("cetona no sangue exige mmol/L", () => {
    expect(ketoneSchema.safeParse({ method: "blood", unit: "mg/dL", value: "1", measured_at: "2020-01-01T10:00" }).success).toBe(false);
    expect(ketoneSchema.safeParse({ method: "blood", unit: "mmol/L", value: "0,6", measured_at: "2020-01-01T10:00" }).success).toBe(true);
  });
  it("classifica pela faixa individual", () => {
    const r = { very_low_mgdl: 54, target_low_mgdl: 80, target_high_mgdl: 160, very_high_mgdl: 250 };
    expect(classifyGlucose(75, r)).toBe("low");
    expect(classifyGlucose(170, r)).toBe("high");
  });
  it("deduplicação idempotente", async () => {
    const readings = await new MockGlucoseProvider().fetchSince(new Date(Date.now() - 3600000));
    expect(filterNewReadings(readings, readings)).toHaveLength(0);
    expect(filterNewReadings([], [...readings, ...readings])).toHaveLength(readings.length);
  });
  it("simulação nunca é marcada como real e não preenche a falha", async () => {
    const r = await new MockGlucoseProvider().fetchSince(new Date(Date.now() - 12 * 3600000));
    expect(r.every((x) => x.source === "simulation")).toBe(true);
    const gap = r.filter((x) => { const h = (Date.now() - new Date(x.measured_at).getTime()) / 3600000; return h > 9.1 && h < 10.9; });
    expect(gap).toHaveLength(0);
  });
  it("importação exige fonte oficial e referência", () => {
    expect(foodImportRowSchema.safeParse({ name: "A", state: "raw", source: "manual", source_reference: "x", carbs_per_100g: 1, protein_per_100g: 1, fat_per_100g: 1, kcal_per_100g: 1 }).success).toBe(false);
  });
});
