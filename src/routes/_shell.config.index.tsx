import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun, UserRound, Syringe, Users, PlugZap, ShieldAlert, LogOut, FlaskConical } from "lucide-react";
import { PageHeader, Card, NavRow } from "@/components/glycare/ui-bits";
import { Segmented } from "@/components/glycare/form";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useTheme } from "@/hooks/use-theme";
import { ROLE_LABEL } from "@/lib/domain/labels";

export const Route = createFileRoute("/_shell/config/")({
  head: () => ({
    meta: [
      { title: "Configurações — GlyCare" },
      { name: "description", content: "Parâmetros da paciente, insulinas, pessoas autorizadas e integrações." },
      { property: "og:title", content: "Configurações — GlyCare" },
      { property: "og:description", content: "Parâmetros da paciente, insulinas, pessoas autorizadas e integrações." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { patient, patients, setPatientId, mode, session, signOut, exitDemo } = useApp();
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" back={false} />
      <Card>
        <p className="text-sm text-muted-foreground">{mode === "demo" ? "Modo demonstração" : session?.user.email}</p>
        <p className="font-bold">{patient?.nickname}</p>
        <p className="text-sm text-muted-foreground">Seu papel: {patient && ROLE_LABEL[patient.role]}</p>
        {patients.length > 1 && (
          <select aria-label="Trocar paciente" className="mt-3 h-11 w-full rounded-md border bg-card px-3" value={patient?.id} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
          </select>
        )}
      </Card>
      <Card className="p-2">
        <NavRow to="/config/paciente" icon={<UserRound className="h-5 w-5" />} title="Paciente e parâmetros" desc="Faixas, prescrição, contato de emergência" />
        <NavRow to="/config/insulinas" icon={<Syringe className="h-5 w-5" />} title="Insulinas" desc="Catálogo e insulinas em uso" />
        <NavRow to="/config/membros" icon={<Users className="h-5 w-5" />} title="Pessoas autorizadas" desc="Cuidadores, paciente, profissionais" />
        <NavRow to="/config/conexao" icon={<PlugZap className="h-5 w-5" />} title="Conexão e integrações" desc="Fontes de glicemia, estado offline" />
        <NavRow to="/config/seguranca" icon={<ShieldAlert className="h-5 w-5" />} title="Segurança e plano de cuidados" desc="Como agir conforme a equipe" />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Aparência</p>
        <Segmented label="Tema" value={theme} onChange={setTheme} options={[{ value: "light", label: "☀ Claro" }, { value: "dark", label: "☾ Escuro" }]} />
        <span className="sr-only">{theme === "dark" ? <Moon /> : <Sun />}</span>
      </Card>
      {mode === "demo" ? (
        <Button variant="outline" size="lg" className="w-full" onClick={exitDemo}><FlaskConical aria-hidden /> Sair da demonstração</Button>
      ) : (
        <Button variant="outline" size="lg" className="w-full" onClick={signOut}><LogOut aria-hidden /> Sair da conta</Button>
      )}
      <p className="px-2 text-center text-xs text-muted-foreground">GlyCare MVP · não é um dispositivo médico validado.</p>
    </div>
  );
}
