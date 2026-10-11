# Fatores por refeicao

Em Configuracoes > Paciente e parametros > Fatores por refeicao e horario,
cada faixa tem um tipo de refeicao, inicio/fim, sensibilidade em **mg/dL por UI**
e relacao de carboidratos em **g por UI**. Os fatores sao distintos.

O perfil demonstrativo usa os exemplos solicitados:

| Refeicao | Sensibilidade | Carboidratos |
| --- | --- | --- |
| Cafe da manha | 20 mg/dL por UI | 10 g por UI |
| Almoco | 30 mg/dL por UI | 12 g por UI |
| Lanche | 30 mg/dL por UI | 10 g por UI |
| Jantar | 40 mg/dL por UI | 18 g por UI |

Os horarios demonstrativos existentes (00-11, 11-15, 15-18 e 18-00) foram
mantidos como organizacao ficticia; sao editaveis e nao representam prescricao.
Os valores de exemplo nao sao aplicados automaticamente a perfis reais.

## Calculo demonstrativo

Alimentacao seleciona ambos os fatores pelo tipo de refeicao escolhido,
mesmo quando registrada fora do horario habitual. Se nao houver um tipo
correspondente cadastrado, utiliza a faixa do horario da refeicao.
Monitoramento usa a faixa do horario atual para o cenario de correcao,
nao o horario de uma leitura anterior.
O app exibe qual faixa foi selecionada.

```text
parcela da refeicao = carboidratos / gramas por UI
parcela da correcao = max(0, (glicemia - alvo) / sensibilidade)
total demonstrativo = refeicao + correcao
```

O arredondamento existente se aplica ao total. Parametros antigos sem
sensibilidade por faixa continuam usando a sensibilidade padrao cadastrada.
Faixas novas exigem fatores positivos, horarios validos sem sobreposicao e
um unico cadastro por tipo de refeicao. Horarios podem cruzar a meia-noite;
o inicio e incluido e o fim e excluido. Lacunas nao sao preenchidas
automaticamente para uma correcao que depende de fator por horario.

## Persistencia

Na conta Cloud autenticada, **Salvar parametros** grava em
`public.clinical_settings`, para o `patient_id` ativo. Os fatores ficam no
JSONB `carb_ratios`: `from`, `to`, `ratio_text`, `sensitivity_text` e
`meal_type`. Nao e necessaria coluna nova ou migracao. A resposta deve retornar
o mesmo paciente antes de o app confirmar sucesso. RLS existente controla
leitura/escrita; nao ha chave administrativa no navegador. Os dados sao
recuperados do Supabase ao entrar novamente, sem cache clinico no aparelho.

Na demonstracao, os parametros ficam apenas na sessao, nunca no Supabase.
Salvar parametros Cloud nao habilita calculo de dose em dados reais: os
calculadores continuam demonstrativos, sem uso de leituras Libre reais.

Verificacao: testes de aritmetica e selecao de faixas/refeicoes, formulario
com reabertura e permissoes, e contrato de leitura/escrita do cliente Supabase.
Os testes de persistencia usam respostas simuladas, nao registros familiares.
Tambem foi conferida a existencia das colunas no projeto informado com
consulta publica `limit=0`, sem ler ou alterar registros de pacientes.
