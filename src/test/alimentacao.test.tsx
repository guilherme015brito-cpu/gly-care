import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientStore } from "@/lib/app-context";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import type { DataStore } from "@/lib/data/store";
import { useFoods, useMeals } from "@/hooks/use-data";
import { Route } from "@/routes/_shell.alimentacao.index";
import { Route as HistoryRoute } from "@/routes/_shell.monitor.insulina.index";
import { nowLocalInput } from "@/lib/domain/labels";
import { demoActionApplications } from "@/lib/insulin/demo-action";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useRouter: () => ({ history: { back: vi.fn() } }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

const FoodPage = Route.options.component as ComponentType;
const AdminHistory = HistoryRoute.options.component as ComponentType;
let client: QueryClient;
let store: DataStore;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function setMode(mode: "demo" | "cloud") {
  const demo = getDemoStore();
  store =
    mode === "demo"
      ? demo
      : {
          ...demo,
          mode: "cloud",
          listFoods: vi.fn().mockRejectedValue(new Error("food_catalog must not be queried")),
          listMeals: vi.fn().mockResolvedValue([]),
          addMeal: vi.fn().mockRejectedValue(new Error("local IDs must not reach Supabase")),
        };
  vi.mocked(usePatientStore).mockReturnValue({
    store,
    mode,
    pid: "demo-patient",
    patient: { id: "demo-patient", nickname: "Teste", birth_date: null, role: "caregiver" },
    readOnly: false,
    key: [mode, "demo-patient"],
  });
}

async function add(name: string, grams: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: name } });
  fireEvent.click(await screen.findByRole("button", { name: `Adicionar ${name}` }));
  fireEvent.change(screen.getByLabelText(`Quantidade em gramas de ${name}`), {
    target: { value: grams },
  });
}

beforeEach(() => {
  resetDemoStore();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});

describe("Alimentação with local TACO", () => {
  it.each(["demo", "cloud"] as const)(
    "loads all TACO foods in %s mode without querying cloud food tables",
    async (mode) => {
      setMode(mode);
      const { result } = renderHook(() => ({ foods: useFoods(), meals: useMeals() }), { wrapper });
      await waitFor(() =>
        expect(result.current.foods.isSuccess && result.current.meals.isSuccess).toBe(true),
      );
      expect(result.current.foods.data!.filter((food) => food.source === "TACO")).toHaveLength(597);
      if (mode === "cloud") {
        expect(store.listFoods).not.toHaveBeenCalled();
        expect(store.listMeals).toHaveBeenCalledWith("demo-patient", 50);
        expect(result.current.meals.data).toEqual([]);
        expect(result.current.foods.data).toHaveLength(597);
      } else {
        expect(
          result.current.foods.data!.filter((food) => food.source === "fictional_example"),
        ).toHaveLength(5);
      }
    },
  );

  it("searches multiple foods, calculates portions and saves a demo meal in memory", async () => {
    setMode("demo");
    await store.listPatients();
    const list = store.listGlucose.bind(store);
    vi.spyOn(store, "listGlucose").mockImplementation(async (pid, since) => {
      const readings = await list(pid, since);
      return readings.map((r, i) =>
        i === readings.length - 1 ? { ...r, value: 180, value_mgdl: 180 } : r,
      );
    });
    render(<FoodPage />, { wrapper });
    expect(screen.getByText("fictícios")).toBeInTheDocument();
    for (const query of ["arroz", "feijão", "frango"]) {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /^Adicionar / }).length).toBeGreaterThan(0),
      );
    }
    await add("Arroz, tipo 1, cozido", "100");
    await add("Feijão, carioca, cozido", "80");
    await add("Frango, peito, sem pele, cozido", "30");
    expect(screen.getByText("28,1 g carb")).toBeInTheDocument();
    expect(screen.getByText("10,9 g carb")).toBeInTheDocument();
    expect(screen.getByText("0 g carb")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "2026-10-10T12:00" } });
    const latest = (await store.listGlucose("demo-patient", new Date(Date.now() - 86400000))).at(
      -1,
    )!;
    await waitFor(() =>
      expect(screen.getByLabelText("Glicemia (mg/dL)")).toHaveValue(String(latest.value_mgdl)),
    );
    expect(screen.getByLabelText("Glicemia (mg/dL)")).toHaveAttribute("readonly");
    expect(await screen.findByText("Refeição: 39 ÷ 12")).toBeInTheDocument();
    expect(screen.getByText("5,5")).toBeInTheDocument();
    const before = (await store.listMeals("demo-patient")).length;
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    expect(
      await screen.findByRole("dialog", { name: "A insulina foi aplicada?" }),
    ).toBeInTheDocument();
    expect(await store.listMeals("demo-patient")).toHaveLength(before);
    fireEvent.click(screen.getByRole("button", { name: "Sim, registrar aplicação" }));
    await waitFor(async () =>
      expect(await store.listMeals("demo-patient")).toHaveLength(before + 1),
    );
    const meal = (await store.listMeals("demo-patient")).find((m) => m.notes === null)!;
    expect(meal.total_carbs_g).toBe(39);
    expect(meal.items).toHaveLength(3);
    expect(meal.items.every((item) => item.food_source === "TACO")).toBe(true);
    const applied = (await store.listAdministrations("demo-patient")).find(
      (a) => a.meal_id === meal.id,
    )!;
    expect(applied.dose_units).toBe(5.5);
    expect(applied.status).toBe("performed");
    expect(applied.confirmed_by_user).toBe(true);
    expect(applied.glucose_before_mgdl).toBe(180);
    expect((await store.listCatalog()).find((c) => c.id === applied.insulin_id)?.brand_name).toBe(
      "Fiasp",
    );
  });

  it("keeps a declined application pending and confirms it later once at its actual time", async () => {
    setMode("demo");
    await store.listPatients();
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "100");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled(),
    );
    const before = (await store.listAdministrations("demo-patient")).length;
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    fireEvent.click(await screen.findByRole("button", { name: "Não, registrar pendente" }));
    await screen.findByText("Refeição registrada. A aplicação ficou pendente.");
    const pending = (await store.listAdministrations("demo-patient")).find(
      (a) => a.status === "planned",
    )!;
    expect(pending.confirmed_by_user).toBe(false);
    const catalog = await store.listCatalog();
    expect(
      demoActionApplications(await store.listAdministrations("demo-patient"), catalog).some(
        (a) => a.administration.id === pending.id,
      ),
    ).toBe(false);
    cleanup();
    render(<AdminHistory />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar aplicação" }));
    const actual = nowLocalInput(new Date(Date.now() - 60000));
    fireEvent.change(screen.getByLabelText("Horário efetivo da aplicação"), {
      target: { value: actual },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sim, aplicação realizada" }));
    await waitFor(async () =>
      expect(
        (await store.listAdministrations("demo-patient")).find((a) => a.id === pending.id)?.status,
      ).toBe("performed"),
    );
    const admins = await store.listAdministrations("demo-patient");
    expect(admins).toHaveLength(before + 1);
    expect(admins.find((a) => a.id === pending.id)?.administered_at).toBe(
      new Date(actual).toISOString(),
    );
    expect(
      demoActionApplications(admins, catalog).some((a) => a.administration.id === pending.id),
    ).toBe(true);
    await store.markAdministrationPerformed(pending.id);
    expect(
      (await store.listAdministrations("demo-patient")).find((a) => a.id === pending.id)
        ?.administered_at,
    ).toBe(new Date(actual).toISOString());
  });

  it("cancels confirmation without saving either record and preserves the composed meal", async () => {
    setMode("demo");
    await store.listPatients();
    const beforeMeals = (await store.listMeals("demo-patient")).length;
    const beforeAdmins = (await store.listAdministrations("demo-patient")).length;
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "100");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    fireEvent.click(await screen.findByRole("button", { name: "Voltar à refeição" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await store.listMeals("demo-patient")).toHaveLength(beforeMeals);
    expect(await store.listAdministrations("demo-patient")).toHaveLength(beforeAdmins);
    expect(screen.getByLabelText("Quantidade em gramas de Arroz, tipo 1, cozido")).toHaveValue(
      "100",
    );
  });

  it("finds TACO foods with or without accent marks", async () => {
    setMode("demo");
    render(<FoodPage />, { wrapper });
    const search = screen.getByRole("searchbox");
    for (const [typed, expected] of [
      ["feijao", "Feijão, carioca, cozido"],
      ["macarrao", "Macarrão, trigo, cru"],
      ["acucar", "Açúcar, cristal"],
      ["cafe", "Café, infusão 10%"],
      ["FEIJÃO", "Feijão, carioca, cozido"],
    ] as const) {
      fireEvent.change(search, { target: { value: typed } });
      expect(
        await screen.findByRole("button", { name: `Adicionar ${expected}` }),
      ).toBeInTheDocument();
    }
  });

  it("saves the selected rounding and updates automatically from a new monitor reading", async () => {
    setMode("demo");
    await store.listPatients();
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "100");
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "2026-10-10T12:00" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled(),
    );
    const readings = await store.listGlucose("demo-patient", new Date(Date.now() - 86400000));
    const latest = readings.at(-1)!;
    client.setQueryData(["demo", "demo-patient", "glucose", 24], [{ ...latest, value_mgdl: 180 }]);
    await waitFor(() => expect(screen.getByLabelText("Glicemia (mg/dL)")).toHaveValue("180"));
    client.setQueryData(["demo", "demo-patient", "glucose", 24], [{ ...latest, value_mgdl: 210 }]);
    await waitFor(() => expect(screen.getByLabelText("Glicemia (mg/dL)")).toHaveValue("210"));
    fireEvent.change(screen.getByLabelText("Arredondamento (UI)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    const button = await screen.findByRole("button", { name: "Sim, registrar aplicação" });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText("Refeição e aplicação registradas.");
    const meal = (await store.listMeals("demo-patient")).find((m) => m.total_carbs_g === 28.1)!;
    const linked = (await store.listAdministrations("demo-patient")).filter(
      (a) => a.meal_id === meal.id,
    );
    expect(linked).toHaveLength(1);
    expect(linked[0]?.dose_units).toBe(5);
    expect(linked[0]?.glucose_before_mgdl).toBe(210);
  });

  it("retains the composed meal and confirmation when saving fails", async () => {
    setMode("demo");
    await store.listPatients();
    vi.spyOn(store, "addMealWithAdministration").mockRejectedValue(
      new Error("Falha de teste: nada foi registrado"),
    );
    const before = (await store.listMeals("demo-patient")).length;
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "100");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sim, registrar aplicação" }));
    await screen.findByText("Falha de teste: nada foi registrado");
    expect(screen.getByRole("dialog", { name: "A insulina foi aplicada?" })).toBeInTheDocument();
    expect(await store.listMeals("demo-patient")).toHaveLength(before);
  });

  it("does not create a zero-dose administration", async () => {
    setMode("demo");
    await store.listPatients();
    const list = store.listGlucose.bind(store);
    vi.spyOn(store, "listGlucose").mockImplementation(async (pid, since) => {
      const readings = await list(pid, since);
      return readings.map((r, i) => (i === readings.length - 1 ? { ...r, value_mgdl: 100 } : r));
    });
    const before = (await store.listAdministrations("demo-patient")).length;
    render(<FoodPage />, { wrapper });
    await add("Frango, peito, sem pele, cozido", "100");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    await screen.findByText("Refeição registrada sem aplicação.");
    expect(await store.listAdministrations("demo-patient")).toHaveLength(before);
  });

  it("shows missing carbs as a dash and blocks saving an incomplete demo meal", async () => {
    setMode("demo");
    const save = vi.spyOn(store, "addMeal");
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "100");
    await add("Azeite, de oliva, extra virgem", "30");
    expect(screen.getByText("— g carb")).toBeInTheDocument();
    expect(screen.getByText(/Total de carboidratos incompleto/)).toBeInTheDocument();
    const carbs = screen.getByText("Carboidratos").parentElement!;
    expect(carbs).toHaveTextContent("—");
    const button = screen.getByRole("button", { name: "Registrar refeição" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(save).not.toHaveBeenCalled();
  });

  it("allows a complete authenticated meal and loads the cloud history", async () => {
    setMode("cloud");
    const savedMeals: Array<unknown> = [];
    store.addMeal = vi.fn(async (_pid, meal) => {
      savedMeals.push(meal);
    });
    store.listMeals = vi.fn().mockResolvedValue([]);
    render(<FoodPage />, { wrapper });
    await add("Arroz, tipo 1, cozido", "80");
    expect(screen.getByText("22,5 g carb")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Registrar refeição" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(store.addMeal).toHaveBeenCalledTimes(1));
    expect(savedMeals).toHaveLength(1);
    expect(store.listFoods).not.toHaveBeenCalled();
  });
});
