# Publicacao e teste no Android

## 1. Publicar a versao com servidor

O endereco de producao e https://gly-care.vercel.app. O projeto Supabase
informado e `eiwysmunvpylfwanxlvj`. As variaveis publicas do repositorio
apontam para esse projeto; nao representam acesso administrativo.

Publique a branch que inclui as alteracoes de refeicoes/insulina, o conector
Libre e estes ajustes. Uma mesclagem apenas na branch intermediaria nao
atualiza `main`. No Vercel, confirme a branch de producao e a pasta raiz do
repositorio. Use o framework TanStack Start, `npm run build`, e remova qualquer
override antigo de Output Directory para `dist` ou `dist/client`.
O Nitro gera `.vercel/output`, incluindo as funcoes; nao publique apenas o
frontend. Nao configure um rewrite SPA que capture as chamadas de servidor.

Em Settings > Environment Variables do Vercel, configure para Production:

| Variavel | Valor/origem |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://eiwysmunvpylfwanxlvj.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicavel desse mesmo projeto |
| `SUPABASE_URL` | Mesmo endereco acima |
| `SUPABASE_PUBLISHABLE_KEY` | Mesma chave publicavel |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada de servidor do MESMO projeto, obtida no painel Supabase |
| `LIBRE_TOKEN_KEY` | 32 bytes aleatorios em hexadecimal (64 caracteres) |

Os project IDs, se configurados, devem ser `eiwysmunvpylfwanxlvj`.
Nao coloque as duas ultimas chaves em variaveis `VITE_*`, no GitHub ou no chat.
Gere a chave de criptografia localmente, por exemplo:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado diretamente para o painel privado e guarde-o em local
seguro. Trocar essa chave exige reconectar as contas. Depois das alteracoes
de ambiente, faca um novo deploy, pois as variaveis VITE sao embutidas no build.

## 2. Confirmar o banco

Execute `supabase/tests/libre_preflight.sql` no SQL Editor do projeto correto.
Essa verificacao nao le registros pessoais e nao altera tabelas.
`patients`, `patient_members` e `glucose_readings` precisam existir, com RLS.
Se faltar a estrutura original, interrompa e compatibilize o esquema existente:
nao reaplique `drizzle/migrations/0000_migration.sql` em um banco ja populado.

Se apenas os objetos Libre estiverem ausentes, aplique uma vez
`supabase/migrations/202610110001_libre_readonly.sql` e repita a verificacao.
As tres tabelas Libre devem ter RLS e NAO permitir SELECT a `anon` ou
`authenticated`. As tres funcoes devem existir. Nao libere essas tabelas para
o navegador para resolver erros: o conector as acessa pelo servidor.

Em Authentication > URL Configuration, confirme a Site URL de producao
`https://gly-care.vercel.app` e as URLs de retorno autorizadas usadas pelo app.
Nao desative RLS, confirmacao de e-mail ou outros controles de seguranca.

## 3. Instalar no celular da mae

1. No Chrome do Android, abra https://gly-care.vercel.app/monitor.
2. Abra o menu de tres pontos e escolha **Adicionar a tela inicial** ou
   **Instalar aplicativo**, conforme a opcao oferecida pelo Chrome.
3. Abra pelo icone GlyCare. Nao e necessario APK ou Play Store.
4. Entre/crie uma conta **GlyCare**, confirme o e-mail quando solicitado, e
   cadastre/selecione o perfil correto da pessoa acompanhada. Nao entre em
   demonstracao para testar leituras reais.
5. Em **Configuracoes > Conexao**, conecte a conta **LibreLinkUp da mae**
   diretamente no formulario. Essa conta e diferente do login GlyCare.
6. Use **Brasil / America Latina**, confirme a autorizacao da pessoa e
   selecione explicitamente a irma na lista. Confirme que o perfil GlyCare
   corresponde a essa mesma pessoa antes de confirmar o vinculo.

Se a tela disser que aguarda ativacao no servidor, nao insista no login:
revise as etapas 1 e 2. Termos, MFA ou pendencias da Abbott devem ser
resolvidos no LibreLinkUp oficial; GlyCare nao os contorna.

## 4. Comparar e testar

Com LibreLinkUp oficial e GlyCare abertos, compare valor, tendencia e
**horario da medicao**, nao apenas o horario da ultima consulta ao servidor.
O GlyCare consulta uma vez por minuto enquanto sua tela esta aberta e em
foco. Pode haver atraso do compartilhamento e nao ha consulta em segundo
plano com o app fechado, nem alarmes clinicos.

- Aguarde uma nova leitura oficial e confirme que apareceu com o mesmo horario.
- Atualize novamente e confirme que nao duplicou a leitura no historico.
- Retire temporariamente a internet e confira que leituras antigas nao sao
  apresentadas como novas; reconecte e confira a recuperacao.
- Desconecte no GlyCare: futuras importacoes devem parar; o historico fica.
- Reconecte a mesma pessoa. Se a sessao expirar, o app pede novo login.
- Confira que leituras reais nao entram nas calculadoras de dose demonstrativas.

Este e um teste experimental de leitura, nao uma validacao clinica. Mantenha
LibreLink/LibreLinkUp oficiais e seus alarmes. Nao use GlyCare para decidir
doses ou substituir o acompanhamento da equipe de saude.
