import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientStore } from "@/lib/app-context";
import { DEFAULT_SETTINGS, type ClinicalSettings } from "@/lib/domain/types";
import type { DataStore } from "@/lib/data/store";
import { Route } from "@/routes/_shell.config.paciente";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
const Page = Route.options.component as ComponentType;
let client: QueryClient;
let stored: ClinicalSettings;
let store: DataStore;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const pid = "invented-patient";
function context(readOnly = false) {
  vi.mocked(usePatientStore).mockReturnValue({
    store,
    pid,
    mode: "cloud",
    readOnly,
    key: ["cloud", pid],
    patient: {
      id: pid,
      nickname: "Teste",
      birth_date: null,
      role: readOnly ? "professional_readonly" : "caregiver",
    },
  });
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  stored = {
    ...DEFAULT_SETTINGS,
    patient_id: pid,
    target_glucose_text: "120",
    carb_ratios: [
      {
        meal_type: "breakfast",
        from: "00:00",
        to: "11:00",
        sensitivity_text: "20",
        ratio_text: "10",
      },
      { meal_type: "lunch", from: "11:00", to: "15:00", sensitivity_text: "30", ratio_text: "12" },
      { meal_type: "snack", from: "15:00", to: "18:00", sensitivity_text: "30", ratio_text: "10" },
      { meal_type: "dinner", from: "18:00", to: "00:00", sensitivity_text: "40", ratio_text: "18" },
    ],
  };
  store = {
    mode: "cloud",
    getSettings: vi.fn(async () => stored),
    updatePatient: vi.fn(async () => {}),
    saveSettings: vi.fn(async (_pid, values) => {
      stored = { ...values, patient_id: pid };
    }),
  } as unknown as DataStore;
  context();
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});

describe("Patient parameter form", () => {
  it("edits separate factors, saves through the Cloud store and restores them after reopening", async () => {
    const view = render(<Page />, { wrapper });
    expect(await screen.findByLabelText("Sensibilidade da faixa 1")).toHaveValue("20");
    expect(screen.getByLabelText("Carboidratos da faixa 4")).toHaveValue("18");
    fireEvent.change(screen.getByLabelText("Sensibilidade da faixa 1"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Carboidratos da faixa 1"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parâmetros" }));
    await waitFor(() => expect(store.saveSettings).toHaveBeenCalledOnce());
    expect(stored.carb_ratios[0]).toMatchObject({
      sensitivity_text: "25",
      ratio_text: "11",
      meal_type: "breakfast",
    });
    view.unmount();
    client.clear();
    render(<Page />, { wrapper });
    expect(await screen.findByLabelText("Sensibilidade da faixa 1")).toHaveValue("25");
    expect(screen.getByLabelText("Carboidratos da faixa 1")).toHaveValue("11");
  });
  it("does not save a zero divisor or overlapping periods", async () => {
    render(<Page />, { wrapper });
    fireEvent.change(await screen.findByLabelText("Sensibilidade da faixa 1"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parâmetros" }));
    expect(screen.getByRole("alert")).toHaveTextContent("maior que zero");
    expect(store.saveSettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Sensibilidade da faixa 1"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Início da faixa 2"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parâmetros" }));
    expect(screen.getByRole("alert")).toHaveTextContent("sobrepor");
    expect(store.updatePatient).not.toHaveBeenCalled();
  });
  it("keeps readonly members from editing or saving factors", async () => {
    context(true);
    render(<Page />, { wrapper });
    expect(await screen.findByLabelText("Sensibilidade da faixa 1")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar parâmetros" })).not.toBeInTheDocument();
  });
  it("shows a loading failure instead of getting stuck in the loading state", async () => {
    vi.mocked(store.getSettings).mockRejectedValue(new Error("Falha de conexão"));
    render(<Page />, { wrapper });
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
  });
});
