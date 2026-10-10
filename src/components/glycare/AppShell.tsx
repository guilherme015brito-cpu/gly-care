import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Settings, Utensils, WifiOff, FlaskConical, Eye } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useOnline } from "@/hooks/use-online";

const TABS = [
  { to: "/monitor", label: "Monitoramento", icon: Activity },
  { to: "/alimentacao", label: "Alimentação", icon: Utensils },
  { to: "/config", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, readOnly, patient } = useApp();
  const online = useOnline();
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link to="/monitor" className="app-brand">
          <img src="/icon-192.png" alt="" />
          Gly<span>Care</span>
        </Link>
        <p className="sidebar-caption">ACOMPANHAMENTO</p>
        <nav aria-label="Navegação desktop">
          {TABS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: false }}
              activeProps={{ "aria-current": "page" }}
              className="sidebar-link"
            >
              <Icon size={19} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-patient">
          <span className="patient-avatar">{patient?.nickname?.slice(0, 1) ?? "G"}</span>
          <div>
            <strong>{patient?.nickname}</strong>
            <span>{mode === "demo" ? "Perfil de demonstração" : "Perfil acompanhado"}</span>
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <div className="workspace-topbar">
          <Link to="/monitor" className="app-brand mobile-brand">
            <img src="/icon-192.png" alt="" />
            Gly<span>Care</span>
          </Link>
          <span className="desktop-topbar-label">Seu acompanhamento, em um só lugar</span>
          <span className="connection-status">
            <span className={online ? "connection-dot" : "connection-dot offline"} />
            {online ? "Conectado" : "Offline"}
          </span>
        </div>
        {mode === "demo" && (
          <div role="status" className="demo-banner">
            <FlaskConical size={14} aria-hidden />
            Demonstração · dados simulados · nada é salvo
          </div>
        )}
        {!online && (
          <div
            role="alert"
            className="flex items-center gap-2 bg-warning-soft px-5 py-2 text-sm text-warning-foreground"
          >
            <WifiOff size={16} aria-hidden />
            Sem conexão. Os dados podem estar desatualizados.
          </div>
        )}
        {readOnly && (
          <div className="flex items-center gap-2 bg-info-soft px-5 py-2 text-sm text-info">
            <Eye size={16} aria-hidden />
            Acesso somente leitura
          </div>
        )}
        <main className="workspace-main">{children}</main>
      </div>
      <nav aria-label="Navegação principal" className="mobile-navigation safe-bottom">
        <ul>
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: false }}
                activeProps={{ "aria-current": "page" }}
              >
                <Icon size={21} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
