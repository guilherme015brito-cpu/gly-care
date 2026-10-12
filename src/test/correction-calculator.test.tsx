import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoDoseCalculator } from "@/components/glycare/DemoDoseCalculator";
import { usePatientStore } from "@/lib/app-context";
import { DEFAULT_SETTINGS, type ClinicalSettings, type GlucoseReading } from "@/lib/domain/types";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: { tipo?: string };
    children: ReactNode;
  }) => <a href={to + (search?.tipo ? "?tipo=" + search.tipo : "")}>{children}</a>,
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
    readOnly: false,
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
  it("offers manual simulation in cloud without importing a patient's readings", async () => {
    const { wrapper } = setup("cloud");
    render(<DemoDoseCalculator kind="correction" at={reading.measured_at} reading={reading} />, {
      wrapper,
    });
    await screen.findByText("Resultado demonstrativo");
    expect(screen.getByLabelText("Glicemia simulada (mg/dL)")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Usar leitura do monitor" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "180" },
    });
    expect(screen.getByText("Correção: máx(0, (180 − 120) ÷ 30)")).toBeInTheDocument();
  });
  it("offers correction registration only after a positive result and without transferring the dose", async () => {
    const { wrapper } = setup("cloud");
    const view = render(<DemoDoseCalculator kind="correction" at={reading.measured_at} />, {
      wrapper,
    });
    await screen.findByText("Resultado demonstrativo");
    expect(screen.queryByRole("link", { name: "Registrar aplicação" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "210" },
    });
    expect(screen.getByRole("link", { name: "Registrar aplicação" })).toHaveAttribute(
      "href",
      "/monitor/insulina/nova?tipo=correction",
    );
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "120" },
    });
    expect(screen.queryByRole("link", { name: "Registrar aplicação" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "bad" },
    });
    expect(screen.queryByRole("link", { name: "Registrar aplicação" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Glicemia simulada (mg/dL)"), {
      target: { value: "210" },
    });
    vi.mocked(usePatientStore).mockReturnValue({ ...usePatientStore(), readOnly: true });
    view.rerender(<DemoDoseCalculator kind="correction" at={reading.measured_at} />);
    expect(screen.queryByRole("link", { name: "Registrar aplicação" })).not.toBeInTheDocument();
  });
  it("switches the correction factor when the scenario time changes", async () => {
    const { wrapper, client } = setup();
    const view = render(
      <DemoDoseCalculator kind="correction" at="2026-10-11T08:00:00" reading={reading} />,
      { wrapper },
    );
    await screen.findByText("Resultado demonstrativo");
    client.setQueryData(["demo", "demo", "settings"], {
      ...settings,
      carb_ratios: [
        { from: "00:00", to: "11:00", sensitivity_text: "20", ratio_text: "10" },
        { from: "11:00", to: "00:00", sensitivity_text: "40", ratio_text: "18" },
      ],
    });
    await waitFor(() =>
      expect(screen.getByText("Correção: máx(0, (180 − 120) ÷ 20)")).toBeInTheDocument(),
    );
    view.rerender(
      <DemoDoseCalculator kind="correction" at="2026-10-11T20:00:00" reading={reading} />,
    );
    expect(screen.getByText("Correção: máx(0, (180 − 120) ÷ 40)")).toBeInTheDocument();
  });
});
