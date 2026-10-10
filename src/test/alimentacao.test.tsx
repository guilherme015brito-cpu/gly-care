import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientStore } from "@/lib/app-context";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import type { DataStore } from "@/lib/data/store";
import { useFoods, useMeals } from "@/hooks/use-data";
import { Route } from "@/routes/_shell.alimentacao.index";

vi.mock("@/lib/app-context", () => ({ usePatientStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useRouter: () => ({ history: { back: vi.fn() } }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

const FoodPage = Route.options.component as ComponentType;
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
          listMeals: vi.fn().mockRejectedValue(new Error("meal tables must not be queried")),
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
    "loads all TACO foods in %s mode without cloud food/meal queries",
    async (mode) => {
      setMode(mode);
      const { result } = renderHook(() => ({ foods: useFoods(), meals: useMeals() }), { wrapper });
      await waitFor(() =>
        expect(result.current.foods.isSuccess && result.current.meals.isSuccess).toBe(true),
      );
      expect(result.current.foods.data!.filter((food) => food.source === "TACO")).toHaveLength(597);
      if (mode === "cloud") {
        expect(store.listFoods).not.toHaveBeenCalled();
        expect(store.listMeals).not.toHaveBeenCalled();
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
    const before = (await store.listMeals("demo-patient")).length;
    fireEvent.click(screen.getByRole("button", { name: "Registrar refeição" }));
    await waitFor(async () =>
      expect(await store.listMeals("demo-patient")).toHaveLength(before + 1),
    );
    const meal = (await store.listMeals("demo-patient"))[0]!;
    expect(meal.total_carbs_g).toBe(39);
    expect(meal.items).toHaveLength(3);
    expect(meal.items.every((item) => item.food_source === "TACO")).toBe(true);
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
      expect(await screen.findByRole("button", { name: `Adicionar ${expected}` })).toBeInTheDocument();
    }
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

  it("calculates in authenticated mode while disabling saves without calling Supabase food/meal methods", async () => {
    setMode("cloud");
    render(<FoodPage />, { wrapper });
    expect(
      screen.getByText(/registro de refeições está temporariamente desabilitado/),
    ).toBeInTheDocument();
    await add("Arroz, tipo 1, cozido", "80");
    expect(screen.getByText("22,5 g carb")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Registrar refeição" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(store.addMeal).not.toHaveBeenCalled();
    expect(store.listMeals).not.toHaveBeenCalled();
    expect(store.listFoods).not.toHaveBeenCalled();
  });
});
