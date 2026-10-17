# Plano alimentar e rodízio

Plano alimentar permite criar vários cardápios, editar nomes e horários das refeições, buscar alimentos, escolher porções e selecionar quais itens entram no total. Os dados são salvos por paciente; edições simultâneas são detectadas pela versão. Alterações ainda não salvas geram confirmação ao sair. Demo usa apenas memória; Cloud usa RLS e auditoria.

A cobertura estimada de cada refeição divide os carboidratos selecionados pela relação configurada para aquela refeição/horário. Nutrientes ausentes, quantidades inválidas e relações ausentes ou ambíguas não geram uma dose. O resultado não inclui glicemia, correção ou insulina em ação e não registra uma aplicação automaticamente.

O local é obrigatório nos quatro fluxos: registro manual/correção, registro junto da refeição, confirmação de pendência e lembrete basal. Braço, perna (coxa), abdômen e nádega são regiões; lados da mesma região contam juntos. A regra solicitada pelo usuário bloqueia a quarta aplicação consecutiva na região e libera após outra região. Não é um protocolo clínico; o rodízio de pontos dentro da região continua dependente da orientação da equipe.

Somente registros realizados, confirmados, não excluídos e não substituídos contam. Registros históricos sem local permanecem intactos. Inserções retroativas verificam os vizinhos dos dois lados; pendências são verificadas novamente na data real da confirmação. Um bloqueio por paciente serializa gravações concorrentes no banco.

## Implantação

Migração: `supabase/migrations/20261017193655_injection_rotation_meal_plans.sql`.

A implantação ocorre em duas etapas para preservar a interface anterior durante a publicação: primeiro aplicar a migração de estrutura acima (apenas aditiva); publicar e verificar a interface; depois aplicar `20261017205354_activate_injection_rotation.sql`, que ativa o gatilho obrigatório. Clientes antigos precisam atualizar a página após a ativação. Em instalações novas, ambas as migrações podem ser aplicadas em sequência.

## Verificação

`npm test -- --maxWorkers=2`, `npx tsc --noEmit` e `npm run build`.

Testes cobrem cálculo por porções, seleção de alimentos, persistência e edição do cardápio, ausência de dados, conflitos de versão, bloqueio da quarta aplicação, troca de região, inserção retroativa e confirmação de pendência. A migração também foi executada em PostgreSQL isolado (PGlite 0.3.14), verificando permissões de cuidador/leitor/usuário externo, auditoria e conflitos.
