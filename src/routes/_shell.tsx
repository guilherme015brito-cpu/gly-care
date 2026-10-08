import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { AppShell } from "@/components/glycare/AppShell";
import { LoadingState, ErrorState } from "@/components/glycare/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_shell")({
  ssr: false,
  component: ShellLayout,
});

function ShellLayout() {
  const { ready, mode, patient, patientsLoading } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && mode === "none") navigate({ to: "/auth", replace: true });
  }, [ready, mode, navigate]);

  if (!ready || mode === "none" || patientsLoading) return <LoadingState />;
  if (!patient) return <Onboarding />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function Onboarding() {
  const { store, setPatientId, signOut } = useApp();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > 80) return setErr(new Error("Informe um nome ou apelido (até 80 caracteres)."));
    setBusy(true);
    try {
      const p = await store!.createPatient(n);
      setPatientId(p.id);
      await qc.invalidateQueries();
      toast.success("Paciente cadastrada");
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-5">
      <div className="card-surface space-y-4 p-5">
        <h1 className="text-2xl font-bold">Vamos começar</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre a paciente que você acompanha. Use um apelido se preferir. Se outra pessoa já cadastrou, peça para ela adicionar seu e-mail em Configurações → Pessoas autorizadas.
        </p>
        <form onSubmit={create} className="space-y-3">
          <div>
            <Label htmlFor="nick">Nome ou apelido da paciente</Label>
            <Input id="nick" className="mt-1 h-12" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          {err ? <ErrorState error={err} /> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Cadastrar paciente"}</Button>
        </form>
        <Button variant="ghost" className="w-full" onClick={signOut}>Sair</Button>
      </div>
    </div>
  );
}
