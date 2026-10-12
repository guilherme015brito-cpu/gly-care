import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientStore } from "@/lib/app-context";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import { Route } from "@/routes/_shell.monitor.insulina.nova";

const search = vi.hoisted(() => ({ tipo: "correction" as string | undefined }));
vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => search }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
const Page = Route.options.component as ComponentType;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  resetDemoStore();
  search.tipo = "correction";
  const store = getDemoStore();
  vi.mocked(usePatientStore).mockReturnValue({
    store,
    mode: "demo",
    pid: "demo-patient",
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
  vi.unstubAllGlobals();
});
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
describe("Correction calculator registration destination", () => {
  it("opens a correction with blank dose and saves only after explicit confirmation", async () => {
    const store = getDemoStore();
    const save = vi.spyOn(store, "addAdministration");
    mount();
    expect(await screen.findByRole("radio", { name: "Correção" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText(/Dose administrada/)).toHaveValue("");
    expect(save).not.toHaveBeenCalled();
    const insulin = (await store.listCatalog()).find((i) => i.brand_name === "Fiasp")!;
    fireEvent.change(screen.getByLabelText("Insulina utilizada"), {
      target: { value: insulin.id },
    });
    fireEvent.change(screen.getByLabelText(/Dose administrada/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar e salvar" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e salvar" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e salvar|Salvar mesmo assim/ }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "demo-patient",
        expect.objectContaining({
          purpose: "correction",
          dose: 3,
          confirmed: true,
          status: "performed",
        }),
        undefined,
      ),
    );
  });
  it("keeps the existing default when opened outside the calculator", async () => {
    search.tipo = undefined;
    mount();
    expect(await screen.findByRole("radio", { name: "Refeição" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
