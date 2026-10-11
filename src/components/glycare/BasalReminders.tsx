import { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import {
  useAdministrations,
  useCatalog,
  usePatientInsulins,
  useStoreMutation,
} from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./ui-bits";

export function BasalReminders() {
  const { readOnly } = usePatientStore();
  const plans = usePatientInsulins();
  const catalog = useCatalog();
  const admins = useAdministrations(200);
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const due = (plans.data ?? [])
    .filter((p) => p.active && p.role === "basal")
    .flatMap((p) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: p.schedule_timezone ?? "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const get = (type: string) => parts.find((x) => x.type === type)?.value;
      const day = `${get("year")}-${get("month")}-${get("day")}`;
      const time = `${get("hour")}:${get("minute")}`;
      if (p.started_on && p.started_on > day) return [];
      return (p.daily_schedule ?? [])
        .filter((s) => s.time <= time)
        .map((s) => ({ p, s, key: `schedule:${p.id}:${day}:${s.time}` }));
    })
    .filter(
      (x) =>
        !admins.data?.some(
          (a) =>
            (a.scheduled_key === x.key || a.notes === x.key) &&
            a.status === "performed" &&
            a.confirmed_by_user,
        ),
    );
  useEffect(() => {
    if (!notifications || admins.isLoading || admins.error) return;
    for (const x of due) {
      if (notified.current.has(x.key)) continue;
      notified.current.add(x.key);
      try {
        void registration.current
          ?.showNotification("GlyCare: registro pendente", {
            body: "Abra o aplicativo para revisar seu lembrete.",
            tag: x.key,
          })
          .catch(() => {
            setNotifications(false);
            setNotificationError("O celular nao permitiu exibir o alerta.");
          });
      } catch {
        setNotifications(false);
      }
    }
  }, [notifications, due, admins.isLoading, admins.error]);
  const save = useStoreMutation(async (s, _pid, v: { id: string; time: string }) => {
    if (!s.confirmScheduledBasal) throw new Error("Confirmacao indisponivel.");
    await s.confirmScheduledBasal(v.id, v.time, new Date().toISOString());
  }, "Aplicacao confirmada");
  if (!plans.data?.some((p) => p.active && p.daily_schedule?.length)) return null;
  return (
    <section className="space-y-3 border-t py-4" aria-label="Lembretes de basal">
      <h2 className="flex items-center gap-2 font-semibold">
        <Bell size={17} />
        Basal: registros de hoje
      </h2>
      <p className="text-xs text-muted-foreground">
        Confira o historico antes de confirmar; uma aplicacao registrada manualmente pode nao estar
        vinculada ao lembrete. Alertas deste recurso funcionam apenas com o aplicativo aberto. Nao
        substituem alarmes ou orientacao da equipe de saude.
      </p>
      {!readOnly && (
        <Button
          variant="outline"
          disabled={notifications}
          onClick={async () => {
            try {
              if (!("Notification" in window) || !("serviceWorker" in navigator))
                throw new Error("Este navegador nao oferece notificacoes.");
              if ((await Notification.requestPermission()) !== "granted")
                throw new Error("Permissao de notificacao nao concedida.");
              await navigator.serviceWorker.register("/reminders-sw.js");
              registration.current = await navigator.serviceWorker.ready;
              setNotificationError("");
              setNotifications(true);
            } catch (e) {
              setNotificationError(
                e instanceof Error ? e.message : "Nao foi possivel ativar notificacoes.",
              );
            }
          }}
        >
          <Bell aria-hidden />
          {notifications ? "Alertas nesta sessao ativados" : "Ativar alertas nesta sessao"}
        </Button>
      )}
      {plans.error && <ErrorState error={plans.error} />}
      {notificationError && (
        <p role="alert" className="text-sm">
          {notificationError}
        </p>
      )}
      {admins.error && <ErrorState error={admins.error} />}
      {save.error && <ErrorState error={save.error} />}
      {due.map((x) => (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
          key={x.key}
        >
          <p>
            <strong>
              {catalog.data?.find((c) => c.id === x.p.insulin_id)?.brand_name ?? "Basal"}
            </strong>{" "}
            · {x.s.time} · {x.s.dose} UI · Registro pendente
          </p>
          {!readOnly && (
            <Button
              disabled={save.isPending || admins.isLoading || !!admins.error}
              onClick={() => {
                if (
                  window.confirm(
                    "A aplicacao foi realmente realizada agora? Confira se ainda nao foi registrada no historico.",
                  )
                )
                  save.mutate({ id: x.p.id, time: x.s.time });
              }}
            >
              <Check aria-hidden />
              Confirmar aplicacao realizada agora
            </Button>
          )}
        </div>
      ))}
      {!due.length && !admins.isLoading && !admins.error && (
        <p className="text-sm">Nenhum registro agendado pendente neste momento.</p>
      )}
    </section>
  );
}
