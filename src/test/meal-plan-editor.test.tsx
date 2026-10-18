import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePatientStore } from "@/lib/app-context";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import { PlanEditor } from "@/routes/_shell.plano-alimentar";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useBlocker: () => ({ status: "idle" }),
  useRouter: () => ({ history: { back: vi.fn() } }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
let client: QueryClient;
beforeEach(() => {
  resetDemoStore();
  vi.mocked(usePatientStore).mockReturnValue({
    store: getDemoStore(),
    pid: "demo-patient",
    mode: "demo",
    key: ["demo", "demo-patient"],
    readOnly: false,
    patient: { id: "demo-patient", nickname: "Teste", birth_date: null, role: "caregiver" },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <PlanEditor />
    </QueryClientProvider>,
  );

it("creates a menu, edits portions and selection, saves and restores it after remount", async () => {
  const store = getDemoStore();
  await store.listPatients();
  const clinical = vi.spyOn(store, "addAdministration");
  mount();
  await screen.findByText("Crie seu primeiro cardápio para começar.");
  fireEvent.change(screen.getByLabelText("Nome do cardápio"), {
    target: { value: "Minha semana" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar refeição" }));
  fireEvent.change(screen.getByLabelText("Nome da refeição"), {
    target: { value: "Almoço planejado" },
  });
  fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "12:30" } });
  fireEvent.change(screen.getByLabelText("Adicionar alimento"), {
    target: { value: "Arroz, tipo 1, cozido" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Arroz, tipo 1, cozido TACO" }));
  fireEvent.change(screen.getByLabelText("Medida"), { target: { value: "spoon" } });
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
  expect(screen.getAllByText("11,2").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir Arroz, tipo 1, cozido" }));
  expect(screen.queryByText("11,2")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir Arroz, tipo 1, cozido" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar cardápio" }));
  await screen.findByText("Cardápio salvo.");
  expect(clinical).not.toHaveBeenCalled();
  cleanup();
  mount();
  await waitFor(() =>
    expect(screen.getByLabelText("Nome do cardápio")).toHaveValue("Minha semana"),
  );
  expect(screen.getByLabelText("Horário")).toHaveValue("12:30");
  expect(screen.getByLabelText("Quantidade")).toHaveValue("2");
  expect(screen.getByLabelText("Medida")).toHaveValue("spoon");
  expect((await store.listMealPlans("demo-patient"))[0]?.meals[0]?.name).toBe("Almoço planejado");
});
it("saves a personalized yogurt ladle and restores the same weight and totals", async () => {
  mount();
  await screen.findByText("Crie seu primeiro cardápio para começar.");
  fireEvent.change(screen.getByLabelText("Nome do cardápio"), {
    target: { value: "Lanche com iogurte" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar refeição" }));
  fireEvent.change(screen.getByLabelText("Adicionar alimento"), {
    target: { value: "Iogurte, natural" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Iogurte, natural TACO" }));
  fireEvent.click(screen.getByText("Personalizar medida"));
  expect(screen.getByLabelText("Medida personalizada")).toHaveValue("concha");
  fireEvent.change(screen.getByLabelText("Peso de 1 medida (g)"), { target: { value: "83" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar medida" }));
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
  expect(screen.getByText(/166 g no total/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Salvar cardápio" }));
  await screen.findByText("Cardápio salvo.");
  cleanup();
  mount();
  await waitFor(() =>
    expect(screen.getByLabelText("Nome do cardápio")).toHaveValue("Lanche com iogurte"),
  );
  expect(screen.getByLabelText("Medida")).toHaveValue("registered-unit");
  expect(screen.getByLabelText("Quantidade")).toHaveValue("2");
  expect(screen.getByText(/166 g no total/)).toBeInTheDocument();
});
