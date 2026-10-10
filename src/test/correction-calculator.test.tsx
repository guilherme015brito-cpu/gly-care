import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoDoseCalculator } from "@/components/glycare/DemoDoseCalculator";
import { usePatientStore } from "@/lib/app-context";
import { DEFAULT_SETTINGS, type ClinicalSettings, type GlucoseReading } from "@/lib/domain/types";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
afterEach(cleanup);
const settings: ClinicalSettings = {
  ...DEFAULT_SETTINGS,
  patient_id: "demo",
  target_glucose_text: "120",
  sensitivity_factor_text: "30",
  carb_ratios: [],
};
const reading: GlucoseReading = {
  id: "r1",
  patient_id: "demo",
  value: 180,
  value_mgdl: 180,
  unit: "mg/dL",
  source: "simulation",
  trend: "stable",
  quality: "valid",
  provider_id: "demo",
  measured_at: "2026-10-10T15:00:00Z",
  received_at: "2026-10-10T15:00:00Z",
  external_id: null,
  notes: null,
};
function setup(mode: "demo" | "cloud" = "demo") {
  const store = { getSettings: vi.fn().mockResolvedValue(settings) };
  vi.mocked(usePatientStore).mockReturnValue({
    mode,
    key: [mode, "demo"],
    pid: "demo",
    store,
  } as unknown as ReturnType<typeof usePatientStore>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}
describe("Automatic monitoring calculator", () => {
  it("tracks simulated readings, allows scenarios and restores automatic mode", async () => {
    const { wrapper } = setup();
    const view = render(
      <DemoDoseCalculator kind="correction" at={reading.measured_at} reading={reading} />,
      { wrapper },
    );
    expect(await screen.findByText("Resultado demonstrativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Glicemia simulada (mg/dL)")).toHaveValue("180");
    expect(screen.getByText("Correção: máx(0, (180 − 120) ÷ 30)")).toBeInTheDocument();
    view.rerender(
      <DemoDoseCalculator
        kind="correction"
        at={reading.measured_at}
        reading={{ ...reading, value_mgdl: 210 }}
      />,
    );
    expect(screen.getByLabelText("Glicemia simulada (mg/dL)")).toHaveValue("210");
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "240" },
    });
    expect(screen.getByText("Correção: máx(0, (240 − 120) ÷ 30)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar leitura do monitor" }));
    expect(screen.getByLabelText("Glicemia simulada (mg/dL)")).toHaveValue("210");
  });
  it("recalculates when settings change and never treats blank as zero", async () => {
    const { wrapper, client } = setup();
    render(<DemoDoseCalculator kind="correction" at={reading.measured_at} reading={reading} />, {
      wrapper,
    });
    await screen.findByText("Resultado demonstrativo");
    client.setQueryData(["demo", "demo", "settings"], {
      ...settings,
      sensitivity_factor_text: "20",
    });
    await waitFor(() =>
      expect(screen.getByText("Correção: máx(0, (180 − 120) ÷ 20)")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), { target: { value: "" } });
    expect(
      screen.getByText("Preencha uma glicemia numérica e não negativa para simular."),
    ).toBeInTheDocument();
  });
  it("does not calculate from an authenticated patient's readings", async () => {
    const { wrapper } = setup("cloud");
    render(<DemoDoseCalculator kind="correction" at={reading.measured_at} reading={reading} />, {
      wrapper,
    });
    expect(screen.queryByText("Resultado demonstrativo")).not.toBeInTheDocument();
  });
});
