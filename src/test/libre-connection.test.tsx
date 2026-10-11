import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  mode: "cloud",
  readonly: false,
  ready: true,
  libre: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@/lib/app-context", () => ({
  usePatientStore: () => ({
    mode: mock.mode,
    readOnly: mock.readonly,
    pid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patient: { nickname: "Pessoa inventada" },
    store: { libre: mock.libre },
  }),
}));
vi.mock("@/hooks/use-libre", () => ({
  useLibreStatus: () => ({
    data: { ready: mock.ready, connected: false, expired: false },
    isLoading: false,
  }),
  useLibreSync: () => ({ refetch: mock.refetch, isFetching: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
import { LibreConnection } from "@/components/glycare/LibreConnection";
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LibreConnection />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.mode = "cloud";
  mock.readonly = false;
  mock.ready = true;
});
describe("Libre connection form", () => {
  it("does not request credentials in Demo", () => {
    mock.mode = "demo";
    mount();
    expect(screen.queryByLabelText("Senha do LibreLinkUp")).not.toBeInTheDocument();
    expect(screen.getByText(/Dados reais não entram/)).toBeInTheDocument();
  });
  it("does not request credentials when the backend is not ready", () => {
    mock.ready = false;
    mount();
    expect(screen.queryByLabelText("Senha do LibreLinkUp")).not.toBeInTheDocument();
    expect(screen.getByText(/aguardando ativação/)).toBeInTheDocument();
  });
  it("does not let a readonly member manage a connection", () => {
    mock.readonly = true;
    mount();
    expect(screen.queryByRole("form", { name: "Conectar LibreLinkUp" })).not.toBeInTheDocument();
  });
  it("clears the password before the request completes and requires explicit person selection", async () => {
    let resolve: (v: unknown) => void = () => {};
    mock.libre.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    mount();
    fireEvent.change(screen.getByLabelText("E-mail do LibreLinkUp"), {
      target: { value: "fake@example.test" },
    });
    const password = screen.getByLabelText("Senha do LibreLinkUp");
    fireEvent.change(password, { target: { value: "invented-password" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: "Conectar LibreLinkUp" }));
    expect(password).toHaveValue("");
    expect(mock.libre).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolve({ draft: "draft", candidates: [{ id: "person", name: "Pessoa compartilhada" }] }),
    );
    expect(screen.getByLabelText("Pessoa acompanhada no LibreLinkUp")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirmar vínculo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mock.libre).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Confirmar vínculo")).not.toBeInTheDocument();
  });
  it("shows authentication failure, not a connected badge", async () => {
    mock.libre.mockResolvedValue({ error: "Falha de autenticação" });
    mount();
    fireEvent.change(screen.getByLabelText("E-mail do LibreLinkUp"), {
      target: { value: "fake@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha do LibreLinkUp"), {
      target: { value: "invented-password" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Conectar LibreLinkUp" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Falha de autenticação"),
    );
    expect(screen.queryByText(/Conta conectada/)).not.toBeInTheDocument();
  });
});
