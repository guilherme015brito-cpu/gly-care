import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type ClinicalSettings, type GlucoseReading } from "@/lib/domain/types";
import { currentGlucoseAlert, shouldNotifyGlucose } from "@/lib/glucose/alerts";
import { BasalReminders } from "@/components/glycare/BasalReminders";

const state = vi.hoisted(() => ({
  readings: [] as GlucoseReading[],
  mode: "cloud",
  error: null as Error | null,
}));
vi.mock("@/lib/app-context", () => ({
  usePatientStore: () => ({ pid: "patient", mode: state.mode, readOnly: false }),
}));
vi.mock("@/hooks/use-data", () => ({
  useGlucose: () => ({ data: state.readings, error: state.error, isLoading: false }),
  useSettings: () => ({ data: { ...DEFAULT_SETTINGS, patient_id: "patient" }, error: null }),
  useAdministrations: () => ({ data: [], error: null }),
  usePatientInsulins: () => ({ data: [], error: null }),
  useCatalog: () => ({ data: [], error: null }),
  useStoreMutation: () => ({ mutate: vi.fn(), error: null, isPending: false }),
}));
const settings: ClinicalSettings = { ...DEFAULT_SETTINGS, patient_id: "patient" };
const now = Date.now();
const reading = (value: number, overrides: Partial<GlucoseReading> = {}): GlucoseReading => ({
  id: String(value),
  patient_id: "patient",
  value,
  value_mgdl: value,
  unit: "mg/dL",
  measured_at: new Date(now - 1000).toISOString(),
  received_at: new Date(now).toISOString(),
  source: "external",
  provider_id: "libre",
  external_id: null,
  quality: "valid",
  trend: "stable",
  notes: null,
  ...overrides,
});
const candidate = (value: number) =>
  currentGlucoseAlert([reading(value)], settings, "cloud", "patient", now)!;
describe("Glucose alert rules", () => {
  it("uses the patient's limits and respects equality at target boundaries", () => {
    expect(candidate(69).band).toBe("low");
    expect(candidate(70).band).toBe("in_range");
    expect(candidate(180).band).toBe("in_range");
    expect(candidate(181).band).toBe("high");
    expect(candidate(53).band).toBe("very_low");
    expect(candidate(251).band).toBe("very_high");
    expect(
      currentGlucoseAlert(
        [reading(75)],
        { ...settings, target_low_mgdl: 80 },
        "cloud",
        "patient",
        now,
      )?.band,
    ).toBe("low");
  });
  it("rejects stale, future, invalid, questionable, non-finite and cross-patient readings", () => {
    for (const change of [
      { measured_at: new Date(now - 21 * 60000).toISOString() },
      { measured_at: new Date(now + 1000).toISOString() },
      { measured_at: "invalid" },
      { quality: "invalid" },
      { quality: "questionable" },
      { value_mgdl: NaN },
      { value_mgdl: 0 },
      { patient_id: "other" },
    ] as Partial<GlucoseReading>[])
      expect(
        currentGlucoseAlert([reading(50, change)], settings, "cloud", "patient", now),
      ).toBeNull();
  });
  it("does not fall back to an older low reading when the newest is invalid or recovered", () => {
    const low = reading(50, { measured_at: new Date(now - 120000).toISOString() });
    expect(currentGlucoseAlert([reading(120), low], settings, "cloud", "patient", now)?.band).toBe(
      "in_range",
    );
    expect(
      currentGlucoseAlert(
        [low, reading(120, { quality: "invalid" })],
        settings,
        "cloud",
        "patient",
        now,
      ),
    ).toBeNull();
  });
  it("isolates simulated and real readings", () => {
    expect(currentGlucoseAlert([reading(50)], settings, "demo", "patient", now)).toBeNull();
    expect(
      currentGlucoseAlert(
        [reading(50, { source: "simulation" })],
        settings,
        "cloud",
        "patient",
        now,
      ),
    ).toBeNull();
  });
  it("deduplicates, throttles repeated bands, and immediately alerts on worsening or opposite band", () => {
    const last = { key: candidate(65).key, band: "low" as const, sentAt: now };
    expect(shouldNotifyGlucose(candidate(65), last, now + 900000)).toBe(false);
    expect(shouldNotifyGlucose(candidate(64), last, now + 1000)).toBe(false);
    expect(shouldNotifyGlucose(candidate(64), last, now + 900000)).toBe(true);
    expect(shouldNotifyGlucose(candidate(50), last, now + 1000)).toBe(true);
    expect(shouldNotifyGlucose(candidate(200), last, now + 1000)).toBe(true);
    expect(shouldNotifyGlucose(candidate(120), last, now + 1000)).toBe(false);
    expect(
      shouldNotifyGlucose(
        candidate(65),
        { ...last, key: "recovered", band: "in_range" },
        now + 1000,
      ),
    ).toBe(true);
  });
});

const showNotification = vi.fn();
beforeEach(() => {
  state.readings = [reading(60)];
  state.mode = "cloud";
  state.error = null;
  showNotification.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({ showNotification }),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Glucose notifications in the existing alerts panel", () => {
  it("enables without basal schedules, sends a low alert once, then sends a high alert", async () => {
    const view = render(<BasalReminders />);
    expect(showNotification).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ativar alertas nesta sessao" }));
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification.mock.calls[0]![0]).toContain("hipoglicemia");
    view.rerender(<BasalReminders />);
    expect(showNotification).toHaveBeenCalledTimes(1);
    state.readings = [reading(220)];
    view.rerender(<BasalReminders />);
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    expect(showNotification.mock.calls[1]![0]).toContain("hiperglicemia");
  });
  it("does not send cached readings when the glucose query fails", async () => {
    state.error = new Error("offline");
    render(<BasalReminders />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar alertas nesta sessao" }));
    await screen.findByText("Alertas nesta sessao ativados");
    expect(showNotification).not.toHaveBeenCalled();
  });
  it("reports permission denial and delivery errors without claiming alerts are active", async () => {
    vi.mocked(Notification.requestPermission).mockResolvedValueOnce("denied");
    render(<BasalReminders />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar alertas nesta sessao" }));
    await screen.findByText("Permissao de notificacao nao concedida.");
    expect(showNotification).not.toHaveBeenCalled();
    showNotification.mockRejectedValueOnce(new Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: "Ativar alertas nesta sessao" }));
    await screen.findByText(/Não foi possível exibir o alerta de glicemia/);
    expect(screen.getByRole("button", { name: "Ativar alertas nesta sessao" })).toBeEnabled();
  });
});
