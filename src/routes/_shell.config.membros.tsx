import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, CardTitle, EmptyState, ErrorState, LoadingState, Notice } from "@/components/glycare/ui-bits";
import { Field, Segmented, inputCls } from "@/components/glycare/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMembers, useStoreMutation } from "@/hooks/use-data";
import { usePatientStore } from "@/lib/app-context";
import { ROLE_LABEL } from "@/lib/domain/labels";
import type { MemberRole } from "@/lib/domain/types";

export const Route = createFileRoute("/_shell/config/membros")({
  head: () => ({
    meta: [
      { title: "Pessoas autorizadas — GlyCare" },
      { name: "description", content: "Gerencie quem pode ver e registrar dados da paciente." },
      { property: "og:title", content: "Pessoas autorizadas — GlyCare" },
      { property: "og:description", content: "Gerencie quem pode ver e registrar dados da paciente." },
    ],
  }),
  component: Members,
});

function Members() {
  const { patient, mode } = usePatientStore();
  const members = useMembers();
  const isCaregiver = patient.role === "caregiver";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("professional_readonly");
  const [err, setErr] = useState("");
  const invite = useStoreMutation(async (s, pid, v: { email: string; role: MemberRole }) => {
    const r = await s.inviteMember(pid, v.email, v.role);
    if (r === "user_not_found") throw new Error("Nenhuma conta com este e-mail. Peça para a pessoa criar a conta no GlyCare primeiro.");
    toast.success("Acesso concedido");
  });
  const remove = useStoreMutation((s, _p, id: string) => s.removeMember(id), "Acesso removido");

  return (
    <div className="space-y-4">
      <PageHeader title="Pessoas autorizadas" />
      <Notice tone="info">Somente pessoas vinculadas conseguem ver os dados desta paciente. Profissionais convidados têm acesso apenas de leitura.</Notice>
      <Card>
        <CardTitle icon={<Users className="h-4 w-4" />}>Vínculos</CardTitle>
        {members.isLoading ? <LoadingState /> : members.error ? <ErrorState error={members.error} /> : !members.data?.length ? <EmptyState title="Sem vínculos" /> : (
          <ul className="divide-y">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{m.display_name ?? `Usuário ${m.user_id.slice(0, 6)}`}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_LABEL[m.role]}</p>
                </div>
                {isCaregiver && !m.is_me && mode === "cloud" && <Button variant="ghost" size="sm" onClick={() => confirm("Remover o acesso desta pessoa?") && remove.mutate(m.id)}>Remover</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {isCaregiver && (
        <Card className="space-y-3">
          <CardTitle icon={<UserPlus className="h-4 w-4" />}>Adicionar pessoa</CardTitle>
          {mode === "demo" && <Notice tone="sim">Indisponível na demonstração.</Notice>}
          <Field id="em" label="E-mail da conta GlyCare" error={err}><Input id="em" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Segmented label="Papel" cols={1} value={role} onChange={setRole} options={(Object.keys(ROLE_LABEL) as MemberRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          <Button size="lg" className="w-full" disabled={mode === "demo" || invite.isPending} onClick={() => {
            const r = z.string().trim().email().max(255).safeParse(email);
            if (!r.success) return setErr("E-mail inválido");
            setErr("");
            invite.mutate({ email: r.data, role }, { onSuccess: () => setEmail("") });
          }}>Conceder acesso</Button>
        </Card>
      )}
    </div>
  );
}
