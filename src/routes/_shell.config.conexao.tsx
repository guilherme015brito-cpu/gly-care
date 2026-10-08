import { createFileRoute } from "@tanstack/react-router";
import { Wifi, WifiOff, PlugZap, Database, Smartphone } from "lucide-react";
import { PageHeader, Card, CardTitle, Notice } from "@/components/glycare/ui-bits";
import { useOnline } from "@/hooks/use-online";
import { useApp } from "@/lib/app-context";
import { PROVIDERS } from "@/lib/glucose/providers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/config/conexao")({
  head: () => ({
    meta: [
      { title: "Conexão e integrações — GlyCare" },
      { name: "description", content: "Estado da conexão e fontes de dados de glicemia." },
      { property: "og:title", content: "Conexão e integrações — GlyCare" },
      { property: "og:description", content: "Estado da conexão e fontes de dados de glicemia." },
    ],
  }),
  component: Connection,
});

const STATUS = { available: ["Disponível", "bg-success-soft text-success"], not_configured: ["Não configurada", "bg-muted text-muted-foreground"], not_implemented: ["Planejada — não implementada", "bg-warning-soft text-warning-foreground"] } as const;

function Connection() {
  const online = useOnline();
  const { mode } = useApp();
  return (
    <div className="space-y-4">
      <PageHeader title="Conexão e integrações" />
      <Card>
        <CardTitle icon={online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}>Estado da conexão</CardTitle>
        <p className="text-lg font-bold">{online ? "Online" : "Offline"}</p>
        <p className="text-sm text-muted-foreground">
          {mode === "demo" ? "Modo demonstração: dados ficam só nesta aba e são apagados ao fechar." : online ? "Registros são enviados ao servidor e só aparecem após confirmação." : "Sem conexão: novos registros não são salvos e não há sincronização pendente."}
        </p>
      </Card>
      <Card>
        <CardTitle icon={<PlugZap className="h-4 w-4" />}>Fontes de glicemia</CardTitle>
        <ul className="space-y-3">
          {PROVIDERS.map((p) => {
            const st = p.status();
            const shown = p.id === "mock" && mode !== "demo" ? "not_configured" : st;
            return (
              <li key={p.id} className="flex items-start justify-between gap-2 rounded-xl border p-3">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.id === "mock" && "Usada apenas na demonstração. Valores sempre marcados como simulação."}
                    {p.id === "manual" && "Leituras de glicosímetro digitadas pela família."}
                    {p.id === "libre" && "Aguardando integração oficial autorizada. Sem coleta de senhas, sem leitura de outros apps."}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[shown][1])}>{STATUS[shown][0]}</span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Notice tone="info" icon={<Smartphone className="mt-0.5 h-4 w-4 shrink-0" />}>
        Este aplicativo web não consegue ler notificações ou dados de outros aplicativos do celular (como o app do sensor).
      </Notice>
      <Card>
        <CardTitle icon={<Database className="h-4 w-4" />}>Dados offline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Por segurança, dados clínicos não são guardados no aparelho. Quando estiver offline, os dados exibidos são apenas os já carregados nesta sessão e podem estar desatualizados. Instale o app pela opção “Adicionar à tela inicial” do navegador.
        </p>
      </Card>
    </div>
  );
}
