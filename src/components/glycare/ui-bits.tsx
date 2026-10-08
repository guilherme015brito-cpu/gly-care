import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, ArrowDown, ArrowDownRight, ArrowRight, ArrowUp, ArrowUpRight, ChevronLeft, FlaskConical, Hand, HelpCircle, Inbox, Loader2, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlucoseSource, GlucoseTrend } from "@/lib/domain/types";
import { SOURCE_LABEL, TREND_LABEL } from "@/lib/domain/labels";
import { BAND_LABEL, type GlucoseBand } from "@/lib/glucose/status";

export function PageHeader({ title, subtitle, back = true, action }: { title: string; subtitle?: string; back?: boolean; action?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-2 pb-4 pt-2">
      {back && (
        <button
          type="button"
          onClick={() => router.history.back()}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("card-surface p-4", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>}
      <h2 className="flex-1 text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

const SOURCE_STYLE: Record<GlucoseSource, string> = {
  simulation: "bg-sim-soft text-sim",
  manual: "bg-info-soft text-info",
  external: "bg-success-soft text-success",
};
const SOURCE_ICON: Record<GlucoseSource, typeof Hand> = { simulation: FlaskConical, manual: Hand, external: PlugZap };

export function SourceBadge({ source, className }: { source: GlucoseSource; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", SOURCE_STYLE[source], className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {SOURCE_LABEL[source]}
    </span>
  );
}

const TREND_ICON: Record<GlucoseTrend, typeof ArrowUp> = {
  rising_fast: ArrowUp,
  rising: ArrowUpRight,
  stable: ArrowRight,
  falling: ArrowDownRight,
  falling_fast: ArrowDown,
  unknown: HelpCircle,
};
export function TrendArrow({ trend, className }: { trend: GlucoseTrend; className?: string }) {
  const Icon = TREND_ICON[trend];
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={TREND_LABEL[trend]}>
      <Icon className="h-7 w-7" aria-hidden strokeWidth={2.5} />
      {trend === "rising_fast" || trend === "falling_fast" ? <Icon className="-ml-4 h-7 w-7" aria-hidden strokeWidth={2.5} /> : null}
      <span className="sr-only">{TREND_LABEL[trend]}</span>
    </span>
  );
}

export const BAND_STYLE: Record<GlucoseBand, string> = {
  very_low: "bg-danger-soft text-destructive",
  low: "bg-warning-soft text-warning-foreground",
  in_range: "bg-success-soft text-success",
  high: "bg-warning-soft text-warning-foreground",
  very_high: "bg-danger-soft text-destructive",
};
export function BandBadge({ band }: { band: GlucoseBand }) {
  const sym = band === "in_range" ? "✓" : band.includes("low") ? "▼" : "▲";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", BAND_STYLE[band])}>
      <span aria-hidden>{sym}</span>
      {BAND_LABEL[band]}
    </span>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{error instanceof Error ? error.message : "Não foi possível carregar os dados."}</span>
    </div>
  );
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warning" | "sim" | "danger"; children: ReactNode; icon?: ReactNode }) {
  const s = { info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning-foreground", sim: "bg-sim-soft text-sim", danger: "bg-danger-soft text-destructive" }[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", s)}>
      {icon ?? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function NavRow({ to, icon, title, desc }: { to: string; icon: ReactNode; title: string; desc?: string }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {desc && <span className="block truncate text-sm text-muted-foreground">{desc}</span>}
      </span>
      <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function FieldError({ msg, id }: { msg?: string | undefined; id?: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-destructive">
      {msg}
    </p>
  );
}
