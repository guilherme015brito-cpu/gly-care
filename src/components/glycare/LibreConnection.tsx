import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Link2, Unplug, RefreshCw, ShieldCheck } from "lucide-react";
import { usePatientStore } from "@/lib/app-context";
import { useLibreStatus, useLibreSync } from "@/hooks/use-libre";
import {
  LIBRE_REGIONS,
  type LibreCandidate,
  type LibreRequest,
} from "@/lib/glucose/libre-contract";
import { fmtDateTime } from "@/lib/domain/labels";
import { Card, CardTitle, ErrorState, LoadingState, Notice } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LibreConnection() {
  const { pid, mode } = usePatientStore();
  return mode === "demo" ? (
    <Card>
      <CardTitle icon={<Link2 size={16} />}>FreeStyle Libre</CardTitle>
      <Notice tone="sim">
        Dados reais não entram na demonstração. Entre na sua conta GlyCare para conectar o Libre.
      </Notice>
      <Button asChild variant="outline" className="mt-3">
        <Link to="/auth">Entrar na conta GlyCare</Link>
      </Button>
    </Card>
  ) : (
    <CloudLibreConnection key={pid} />
  );
}

function CloudLibreConnection() {
  const { store, pid, patient, readOnly } = usePatientStore();
  const qc = useQueryClient();
  const status = useLibreStatus();
  const sync = useLibreSync(!!status.data?.connected && !status.data.expired);
  const [draft, setDraft] = useState<{ id: string; candidates: LibreCandidate[] } | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const ready = status.data?.ready;

  async function run(request: LibreRequest) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await store.libre(request);
      if (!alive.current) return;
      if (result.error) throw new Error(result.error);
      if (result.draft && result.candidates) {
        setDraft({ id: result.draft, candidates: result.candidates });
        setSelected("");
      } else {
        setDraft(null);
        setReconnect(false);
        await qc.invalidateQueries();
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível conectar.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const request: LibreRequest = {
      action: "login",
      pid,
      email: String(data.get("email")),
      password: String(data.get("password")),
      region: String(data.get("region")) as (typeof LIBRE_REGIONS)[number],
      consent: true,
    };
    // Uncontrolled password: clear before the network request and never put it
    // into React Query mutation state, persisted form state or browser storage.
    const password = form.elements.namedItem("password") as HTMLInputElement;
    password.value = "";
    void run(request);
  }
  const state = status.data;
  const showLogin =
    ready && !readOnly && (!state?.connected || state.expired || reconnect) && !draft;
  return (
    <Card>
      <CardTitle icon={<Link2 size={16} />}>
        FreeStyle Libre{" "}
        <span className="ml-2 text-xs font-normal text-muted-foreground">Experimental</span>
      </CardTitle>
      <div className="space-y-4">
        <Notice tone="info" icon={<ShieldCheck size={16} className="shrink-0" />}>
          Somente leitura. Não substitui o LibreLink ou seus alarmes e não alimenta cálculos de
          insulina.
        </Notice>
        {status.isLoading && <LoadingState />}
        {status.error && <ErrorState error={status.error} />}
        {state && !ready && (
          <Notice tone="warning">
            Conexão aguardando ativação no servidor. Nenhuma senha será solicitada enquanto a
            configuração estiver incompleta.
          </Notice>
        )}
        {state?.connected && (
          <div className="space-y-2">
            <p className="font-semibold">
              {state.expired ? "Sessão expirada" : "Conta conectada"} · {state.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Última consulta:{" "}
              {state.lastSync ? fmtDateTime(state.lastSync) : "Ainda não realizada"}
            </p>
            {state.error && <ErrorState error={new Error(state.error)} />}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || sync.isFetching || state.expired}
                onClick={() => void sync.refetch()}
              >
                <RefreshCw size={16} /> Atualizar
              </Button>
              {!readOnly && (
                <Button variant="outline" disabled={busy} onClick={() => setReconnect(true)}>
                  <Link2 size={16} /> Reconectar
                </Button>
              )}
              {!readOnly && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Desconectar o Libre? As leituras já registradas serão mantidas.",
                      )
                    )
                      void run({ action: "disconnect", pid });
                  }}
                >
                  <Unplug size={16} /> Desconectar
                </Button>
              )}
            </div>
          </div>
        )}
        {showLogin && (
          <form onSubmit={login} className="space-y-3" aria-label="Conectar LibreLinkUp">
            <p className="text-sm">
              Conta de acompanhamento do LibreLinkUp. Paciente GlyCare:{" "}
              <strong>{patient.nickname}</strong>.
            </p>
            <div>
              <Label htmlFor="libre-email">E-mail do LibreLinkUp</Label>
              <Input
                id="libre-email"
                name="email"
                type="email"
                autoComplete="off"
                maxLength={254}
                required
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="libre-password">Senha do LibreLinkUp</Label>
              <Input
                id="libre-password"
                name="password"
                type="password"
                autoComplete="off"
                maxLength={512}
                required
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="libre-region">Região da conta</Label>
              <select
                id="libre-region"
                name="region"
                defaultValue="LA"
                disabled={busy}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {LIBRE_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === "LA" ? "Brasil / América Latina" : r}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input name="consent" type="checkbox" required disabled={busy} className="mt-1" />
              <span>
                Tenho autorização da pessoa acompanhada para importar estas leituras para o GlyCare.
              </span>
            </label>
            <Button type="submit" disabled={busy}>
              <Link2 size={16} />
              {busy ? "Conectando..." : "Consultar pessoas compartilhadas"}
            </Button>
          </form>
        )}
        {draft && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ action: "select", pid, draft: draft.id, connection: selected });
            }}
          >
            <Label htmlFor="libre-person">Pessoa acompanhada no LibreLinkUp</Label>
            <select
              id="libre-person"
              required
              value={selected}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Selecione a pessoa</option>
              {draft.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Vincular ao paciente <strong>{patient.nickname}</strong>. Confirme que é a mesma
              pessoa.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !selected}>
                <Link2 size={16} />
                {busy ? "Importando..." : "Confirmar vínculo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {error && <ErrorState error={new Error(error)} />}
        {sync.error && <ErrorState error={sync.error} />}
        {readOnly && (
          <p className="text-sm text-muted-foreground">
            Apenas o paciente ou cuidador pode gerenciar a conexão.
          </p>
        )}
      </div>
    </Card>
  );
}
