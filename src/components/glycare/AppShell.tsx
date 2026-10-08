import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Settings, Utensils, WifiOff, FlaskConical, Eye } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/monitor", label: "Monitoramento", icon: Activity },
  { to: "/alimentacao", label: "Alimentação", icon: Utensils },
  { to: "/config", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, readOnly } = useApp();
  const online = useOnline();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      {mode === "demo" && (
        <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-sim px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Demonstração · dados simulados · nada é salvo
        </div>
      )}
      {!online && (
        <div role="alert" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-xs font-bold text-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Sem conexão — dados podem estar desatualizados e novos registros não serão salvos
        </div>
      )}
      {readOnly && (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-3 py-1.5 text-xs font-semibold text-info">
          <Eye className="h-3.5 w-3.5" aria-hidden /> Acesso somente leitura
        </div>
      )}
      <main className="flex-1 px-4 pb-28 pt-2">{children}</main>
      <nav
        aria-label="Navegação principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t bg-card/95 backdrop-blur [box-shadow:var(--shadow-float)]"
      >
        <ul className="grid grid-cols-3">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex min-h-16 flex-col items-center justify-center gap-1 pt-2 text-xs font-semibold text-muted-foreground"
                activeProps={{ className: "text-primary", "aria-current": "page" }}
                activeOptions={{ exact: false }}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive && "bg-primary-soft")}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {label}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
