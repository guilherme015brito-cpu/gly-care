import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GlyCare — Acompanhamento de Diabetes Tipo 1" },
      { name: "description", content: "Monitoramento familiar de glicemia, insulina e alimentação para diabetes tipo 1." },
      { property: "og:title", content: "GlyCare — Acompanhamento de Diabetes Tipo 1" },
      { property: "og:description", content: "Monitoramento familiar de glicemia, insulina e alimentação para diabetes tipo 1." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/monitor" });
  },
});
