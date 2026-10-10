# Estudo técnico — IOB Fiasp (sem cálculo clínico no GlyCare)

**Estado:** referência selecionada para pesquisa e futura validação; ainda não implementada como estimativa numérica nem aprovada para recomendação de doses.

## Fontes primárias

- Novo Nordisk, guia brasileiro Fiasp: https://www.novonordiskbrasilinfo.com/guia-de-uso-fiasp.html
- DailyMed, informações regulatórias Fiasp: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=834e7efc-393f-4c55-9125-628562a8a5cf
- OpenAPS, curvas de ação de insulina (referência de simulação): https://openaps.readthedocs.io/en/latest/docs/While%20You%20Wait%20For%20Gear/understanding-insulin-on-board-calculations.html
- LoopDocs, descrição da modelagem exponencial: https://loopkit.github.io/loopdocs/operation/algorithm/prediction/

## Modelo de referência

OpenAPS descreve um modelo exponencial para análogos ultrarrápidos com referências de cinco horas de ação e pico matemático em 55 minutos. São escolhas de modelagem para um sistema e não parâmetros individuais obtidos a partir da prescrição médica de um paciente.

A documentação da Fiasp informa ação por várias horas e apresenta variabilidade conforme dose e pessoa. DailyMed publica resultados aproximados de retorno do efeito à linha de base entre cinco e sete horas nas doses estudadas.

Não é possível concluir só com essas fontes que o valor numérico de IOB calculado corresponderia ao efeito residual num paciente específico. Portanto, nenhuma dose automática deve derivar desse estudo.

## Requisitos antes de um cálculo de IOB de uso clínico

- Identificar por catálogo as insulinas rápidas; não misturar a basal ao IOB da rápida.
- Analisar somente aplicações efetivamente confirmadas, sem contar lançamentos planejados, duplicados ou substituídos.
- Trabalhar com horário completo, fuso e histórico potencialmente incompleto; nunca interpretar ausência de registro como certeza de ausência de insulina ativa.
- Exigir rastreabilidade do modelo, versão, parâmetros e referências.
- Construir testes determinísticos de sobreposição, futuro, dados inválidos, aplicações não confirmadas, glargina basal e doses recentes.
- Obter validação específica antes de liberar resultados numéricos que influenciem aplicação real, principalmente em paciente pediátrico.

## Funcionalidades liberadas sem estimativa clínica

O GlyCare pode registrar alimentos, calcular gramas de carboidratos pela TACO, guardar os fatores prescritos por refeição, exibir histórico de aplicações informadas e mostrar a hora transcorrida desde cada aplicação rápida. A soma de doses aplicadas não é um substituto de IOB.
