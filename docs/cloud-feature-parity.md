# Funcoes do perfil conectado

- TACO permanece local e completa, junto dos alimentos e receitas pessoais do Supabase.
- Cadastro de alimentos, favoritos, refeicoes e cetonas usam RLS por paciente.
- O grafico de insulina usa aplicacoes confirmadas, nao pendentes nem substituidas.
  As curvas sao ilustrativas, nao representam insulina restante ou IOB.
- As calculadoras de refeicao e correcao aparecem no modo conectado como
  simulacoes manuais. Leituras reais, inclusive manuais, nao sao importadas.
  Os fatores informados pelo usuario para este teste sao exemplos demonstrativos.
- Ao registrar uma refeicao, o usuario pode salvar apenas a refeicao ou informar
  manualmente uma dose e confirmar uma aplicacao/planejamento independente.
  O resultado da calculadora nunca preenche nem registra essa dose no Cloud.
- Refeicao e aplicacao manual usam uma unica transacao, com chave de requisicao
  para impedir duplicacao em uma repeticao da mesma confirmacao.

## Verificacao e publicacao

Verificacoes locais: TypeScript e ESLint passaram; a suite completa passou com
133 testes em 16 arquivos.

O build completo do Vercel passou, incluindo a montagem final do Nitro. O erro
anterior `EPERM` era uma restricao do ambiente local, resolvida executando o build
com a permissao apropriada, sem alterar dependencias nem configuracao do projeto.

Migracoes aplicadas ao projeto `eiwysmunvpylfwanxlvj` em 2026-10-11:
- `supabase/migrations/20261011152722_cloud_feature_parity.sql`.
- `supabase/migrations/20261011154445_cloud_meal_request_id_fix.sql`.

A segunda grava a chave de requisicao no INSERT. A primeira tentativa de usar
UPDATE nao persistia a chave, pois refeicoes intencionalmente nao possuem politica
de UPDATE. A correcao preserva RLS e a assinatura do RPC de refeicao existente.
Nao reaplicar; nao alterar credenciais Libre nem os registros existentes.

O teste `supabase/tests/cloud_feature_parity.sql` cria somente fixtures temporarias
e faz rollback. Verifica confirmacao, atomicidade, repeticao e isolamento entre
pacientes, incluindo uma falha na aplicacao apos a criacao da refeicao e um
registro pendente. Passou no Supabase publicado, com rollback de todas as fixtures.

Para publicar, enviar o commit a `main`, aguardar o status de sucesso do Vercel
para esse mesmo SHA e conferir as telas em `https://gly-care.vercel.app`.

O advisor de seguranca nao apontou problemas nas novas tabelas ou nos novos RPCs.
Continuam os avisos existentes sobre helpers SECURITY DEFINER e protecao de
senhas vazadas. As tabelas privadas Libre continuam sem politicas de cliente
intencionalmente; sao acessadas apenas pelo servidor.
Referencias: [funcoes SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[protecao de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
