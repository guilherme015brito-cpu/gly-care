# GlyCare — Arquitetura resumida do MVP

## Ajustes à stack pedida
- React + TypeScript + Vite + Tailwind + shadcn/ui + Lucide + Recharts + Zod: mantidos (sobre TanStack Start, o framework fixo deste ambiente; código continua exportável para GitHub).
- Supabase: via **Lovable Cloud** (Postgres + Auth + RLS, sem conta externa). Nenhuma chave privilegiada no frontend.
- Hospedagem: publicação Lovable (Vercel não é alvo suportado aqui; o código pode ser migrado depois).
- PWA: manifesto + ícones (instalável no Android) e service worker só para arquivos estáticos, desativado no preview. Sem cache de dados clínicos.

## Navegação (3 abas fixas na base)
```text
/auth                      Login e cadastro
/monitor   (aba 1)         Dashboard: glicemia atual, gráfico, insulina, IOB (placeholder), ações rápidas
  /monitor/glicemia        Histórico de glicemia + registro manual
  /monitor/insulina        Histórico de aplicações + auditoria de correções
  /monitor/insulina/nova   Registro de aplicação (realizada x planejada, confirmação, aviso de duplicidade)
  /monitor/cetonas         Registro e histórico de cetonas
/alimentacao (aba 2)       Busca de alimentos e composição de refeição (totais automáticos)
  /alimentacao/historico   Histórico por tipo de refeição
  /alimentacao/novo        Cadastro manual de alimento / receita
/config    (aba 3)
  /config/paciente         Parâmetros prescritos (armazenados, nunca usados para sugerir dose)
  /config/insulinas        Catálogo de insulinas + insulinas em uso
  /config/membros          Vínculo de cuidador / paciente / profissional (leitura)
  /config/conexao          Estado online/offline, fontes de glicemia, Libre (futuro)
  /config/seguranca        Orientação para consultar o plano do endocrinologista
```

## Banco de dados (migração SQL versionada)
Tabelas: profiles, patients, patient_members (papel: caregiver | patient | professional_readonly), insulin_catalog, insulin_action_profiles (campos textuais/intervalos, status de validação), patient_insulins (+ histórico de alterações), insulin_administrations (status performed/planned, confirmed flag, supersedes_id para correções), glucose_readings (unique patient+source+external_id para idempotência, unidade original preservada), food_catalog (por 100 g, cru/cozido, fonte, flag fictício), meal_entries, meal_items, ketone_readings (CHECK de unidade compatível com método), clinical_settings, audit_logs (trigger em insert/update).

RLS em todas: acesso via função `is_patient_member(patient_id)` (security definer); escrita negada para profissional_readonly. Índices (patient_id, measured_at).

## Fontes de glicemia
`GlucoseProvider` (interface) com `MockGlucoseProvider` (marcado "SIMULAÇÃO"), `ManualGlucoseProvider` e `FutureLibreProvider` (apenas stub, sem scraping/credenciais).

## Modo demonstração
Sem login → modo demo isolado em memória, faixa visível "DADOS SIMULADOS", nada persistido. Alimentos de exemplo marcados como fictícios; estrutura de importação CSV/JSON validada com Zod.

## Visual
Fundo branco/cinza claro, verde-azulado principal, cards arredondados com sombra sutil, botões grandes, claro/escuro, glicemia com cor + texto + ícone (nunca só cor). Otimizado para 360–430 px.

## Fora de escopo (por segurança)
Cálculo de dose, IOB calculado, botão "aplicar dose recomendada", orientações automáticas, IA, pagamentos.

## Testes
Vitest: cálculo nutricional, validações Zod (dose, cetonas, unidades), deduplicação de leituras, e teste SQL das políticas RLS.

## Entrega
Uma iteração principal: Cloud + migração, design system, rotas e telas acima, testes. Telas secundárias completas mas enxutas.
