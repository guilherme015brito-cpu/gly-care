import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
vi.mock("@/lib/glucose/libre.functions", () => ({ libreRequest: vi.fn() }));
import { cloudStore } from "@/lib/data/cloud-store";
import { DEFAULT_SETTINGS } from "@/lib/domain/types";

const pid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const settings = {
  ...DEFAULT_SETTINGS,
  carb_ratios: [
    {
      meal_type: "lunch" as const,
      from: "11:00",
      to: "15:00",
      ratio_text: "12",
      sensitivity_text: "30",
    },
  ],
};
function query(data: unknown, error: unknown = null) {
  const q = {
    upsert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const method of ["upsert", "select", "eq"] as const) q[method].mockReturnValue(q);
  q.single.mockResolvedValue({ data, error });
  q.maybeSingle.mockResolvedValue({ data, error });
  mock.from.mockReturnValue(q);
  return q;
}
beforeEach(() => vi.clearAllMocks());

describe("Supabase settings persistence contract", () => {
  it("writes both factors and the meal into the existing JSON and confirms the patient", async () => {
    const q = query({ patient_id: pid });
    await cloudStore.saveSettings(pid, settings);
    expect(mock.from).toHaveBeenCalledWith("clinical_settings");
    expect(q.upsert).toHaveBeenCalledWith(
      { ...settings, patient_id: pid },
      { onConflict: "patient_id" },
    );
    expect(q.select).toHaveBeenCalledWith("patient_id");
    expect(q.single).toHaveBeenCalledOnce();
  });
  it("restores both factors and the meal from Supabase rather than a device cache", async () => {
    const q = query({ ...settings, patient_id: pid });
    expect(await cloudStore.getSettings(pid)).toMatchObject({ carb_ratios: settings.carb_ratios });
    expect(q.eq).toHaveBeenCalledWith("patient_id", pid);
  });
  it("rejects invalid factors before a network write", async () => {
    await expect(
      cloudStore.saveSettings(pid, {
        ...settings,
        carb_ratios: [
          {
            ...settings.carb_ratios[0]!,
            sensitivity_text: "0",
          },
        ],
      }),
    ).rejects.toThrow("maior que zero");
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("does not claim success for denied or empty writes", async () => {
    query(null, { code: "42501", message: "row-level security" });
    await expect(cloudStore.saveSettings(pid, settings)).rejects.toThrow("permissão");
    query(null);
    await expect(cloudStore.saveSettings(pid, settings)).rejects.toThrow("confirmar");
  });
});
