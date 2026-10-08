import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Phone, FileText } from "lucide-react";
import { PageHeader, Card, CardTitle, Notice } from "@/components/glycare/ui-bits";
import { useSettings } from "@/hooks/use-data";

export const Route = createFileRoute("/_shell/config/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança e plano de cuidados — GlyCare" },
      { name: "description", content: "Como consultar o plano de cuidados da equipe em situações de risco." },
      { property: "og:title", content: "Segurança e plano de cuidados — GlyCare" },
      { property: "og:description", content: "Como consultar o plano de cuidados da equipe em situações de risco." },
    ],
  }),
  component: Safety,
});

const SITUATIONS = [
  ["Hipoglicemia", "Glicemia abaixo da faixa ou sintomas como tremor, suor, confusão."],
  ["Hiperglicemia", "Glicemia persistentemente acima da faixa definida pela equipe."],
  ["Doença (febre, vômito, diarreia)", "Situações que costumam exigir o plano de “dias de doença”."],
  ["Suspeita de cetose", "Cetonas positivas, náusea, dor abdominal, respiração acelerada."],
];

function Safety() {
  const s = useSettings();
  return (
    <div className="space-y-4">
      <PageHeader title="Segurança" />
      <Notice tone="danger" icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}>
        Em emergência, ligue <strong>192 (SAMU)</strong>. O GlyCare não orienta aplicar, aumentar, reduzir ou adiar insulina, nem decide se a paciente deve comer ou esperar.
      </Notice>
      <Card>
        <CardTitle icon={<FileText className="h-4 w-4" />}>Consulte o plano de cuidados do endocrinologista</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">Tenha o plano escrito pela equipe sempre acessível. Para cada situação abaixo, siga exatamente o que o plano determina e, em caso de dúvida, contate a equipe.</p>
        <ul className="space-y-2">
          {SITUATIONS.map(([t, d]) => (
            <li key={t} className="rounded-xl bg-muted p-3">
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Instruções registradas da equipe</CardTitle>
        <p className="whitespace-pre-wrap text-sm">{s.data?.clinical_instructions || "Nenhuma instrução transcrita. Cadastre em Paciente e parâmetros."}</p>
        {s.data?.last_review_date && <p className="mt-2 text-xs text-muted-foreground">Última revisão: {s.data.last_review_date}</p>}
      </Card>
      {s.data?.emergency_contact_phone && (
        <a href={`tel:${s.data.emergency_contact_phone.replace(/[^+\d]/g, "")}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground">
          <Phone className="h-5 w-5" aria-hidden /> Ligar para {s.data.emergency_contact_name ?? "contato de emergência"}
        </a>
      )}
    </div>
  );
}
