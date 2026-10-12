# Perfis e lembretes

## Dados para cadastro

Fiasp U-100: insulina asparte, Novo Nordisk, via subcutanea, prandial ultrarrapida.
Maior efeito entre 1 e 3 horas; duracao usual 3 a 5 horas segundo o guia brasileiro.
Nao significa acao forte durante os primeiros 20 minutos. A bula americana,
tabela 6, descreve inicio 16/17/20 minutos, pico 91/122/133 minutos e retorno ao
basal 5/6/7 horas nos estudos de 0,1/0,2/0,4 UI/kg. Nao calcular uma janela
pessoal a partir desses estudos. Preset grafico: 17, 120, 300 minutos, marcos
ilustrativos escolhidos, nao medidas reais de um paciente.

Lantus U-100: insulina glargina, Sanofi, via subcutanea, basal de longa acao.
Perfil relativamente constante por cerca de 24 horas, sem pico pronunciado.
A bula descreve uma aplicacao diaria. O app aceita varios horarios definidos
externamente, mas nao recomenda dividir Lantus nem cria doses automaticamente.
Preset grafico: rampa ilustrativa de 60 min, pico ausente, janela de 1440 min.
Essa rampa NAO e um inicio de acao farmacologico fixo.

Fontes oficiais consultadas em 2026-10-11:
- https://www.novonordiskbrasilinfo.com/guia-de-uso-fiasp.html
- https://www.novo-pi.com/fiasp.pdf
- https://products.sanofi.us/lantus/lantus.html

## Cadastro

Configuracoes > Insulinas > Catalogo > Editar perfil do grafico. Os presets
preenchem referencias, nao substituem conferir marca e concentracao. Para outra
insulina, informar marcos em minutos e link da fonte oficial; sem perfil nao ha
curva presumida pelo nome no Cloud.

Em uso > Adicionar ao tratamento > Basal: escolher quantidade de aplicacoes,
informar horario e dose de cada uma. Fuso e o do dispositivo no cadastro e fica
salvo no Supabase. Tratamentos antigos nao recebem horarios ou doses ficticios.
Para trocar um esquema, encerrar o registro anterior e cadastrar o novo.

No Monitoramento, lembretes de hoje mostram registros pendentes. Confirmar
significa que a aplicacao realmente aconteceu agora. O RPC usa horario real,
RLS, validacao do esquema e deduplicacao por tratamento/dia/horario. Nenhuma
aplicacao e marcada realizada sem confirmacao. Revisar registros manuais para
nao confirmar duas vezes a mesma aplicacao por fluxos diferentes.

## Limite das notificacoes

Alertas do sistema operam SOMENTE com o app aberto nesta implementacao, por
Service Worker e permissao expressa. A mensagem externa e generica, sem dose
ou nome de insulina na tela bloqueada. Nao ha armazenamento clinico no aparelho.
Com o app fechado, falta implementar e configurar Web Push: inscricao autenticada
por dispositivo, chaves VAPID privadas no servidor, despachante agendado,
revogacao e teste em Android. Nao afirmar que timers no navegador sao um alarme
confiavel em segundo plano. Fontes: https://developer.mozilla.org/en-US/docs/Web/API/Push_API

O grafico mostra janelas normalizadas por aplicacao confirmada, nao mede insulina
ativa, nao garante horario de fim e nao calcula IOB nem doses adicionais.
