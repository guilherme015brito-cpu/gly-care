import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/glycare/ui-bits";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — GlyCare" },
      { name: "description", content: "Entre ou crie sua conta no GlyCare." },
      { property: "og:title", content: "Entrar — GlyCare" },
      { property: "og:description", content: "Entre ou crie sua conta no GlyCare." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(72),
  name: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { session, mode, enterDemo, ready } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (ready && (session || mode === "demo")) navigate({ to: "/monitor", replace: true });
  }, [ready, session, mode, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (tab === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw new Error(error.message.includes("Invalid") ? "E-mail ou senha incorretos." : error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "Não foi possível entrar.");
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: parsed.data.name || undefined } },
        });
        if (error) throw new Error(error.message.includes("registered") ? "Este e-mail já está cadastrado." : error.message.includes("leaked") || error.message.includes("weak") ? "Senha muito fraca ou já exposta em vazamentos. Escolha outra." : "Não foi possível criar a conta.");
        setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <img src="/icon-192.png" alt="" width={72} height={72} className="mb-3 rounded-2xl" />
        <h1 className="text-3xl font-extrabold">GlyCare</h1>
        <p className="mt-1 text-muted-foreground">Acompanhamento familiar de diabetes tipo 1</p>
      </div>

      <div className="card-surface p-5">
        {sent ? (
          <div className="space-y-3 text-center" role="status">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <h2 className="text-lg font-bold">Confirme seu e-mail</h2>
            <p className="text-sm text-muted-foreground">Enviamos um link para {form.email}. Depois de confirmar, volte e entre.</p>
            <Button variant="outline" className="w-full" onClick={() => { setSent(false); setTab("in"); }}>Voltar para entrar</Button>
          </div>
        ) : (
          <>
            <div role="tablist" className="mb-5 grid grid-cols-2 rounded-xl bg-muted p-1">
              {(["in", "up"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-10 rounded-lg text-sm font-semibold ${tab === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                  {t === "in" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {tab === "up" && (
                <div>
                  <Label htmlFor="name">Seu nome (opcional)</Label>
                  <Input id="name" className="mt-1 h-12" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                </div>
              )}
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" inputMode="email" className="mt-1 h-12" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" aria-invalid={!!errors.email} />
                <FieldError msg={errors.email} />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" className="mt-1 h-12" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={tab === "in" ? "current-password" : "new-password"} aria-invalid={!!errors.password} />
                <FieldError msg={errors.password} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Aguarde…" : tab === "in" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
            <Button variant="outline" size="lg" className="w-full" onClick={google}>Continuar com Google</Button>
          </>
        )}
      </div>

      <Button variant="soft" size="lg" className="mt-4 w-full" onClick={() => { enterDemo(); navigate({ to: "/monitor" }); }}>
        <FlaskConical aria-hidden /> Ver demonstração com dados simulados
      </Button>
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        O GlyCare não é um dispositivo médico validado e não substitui sensor, glicosímetro, prescrição ou orientação da equipe de saúde.
      </p>
    </div>
  );
}
