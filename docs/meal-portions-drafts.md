# Refeições, porções e exclusão de insulina

A última glicemia válida das últimas 24 horas aparece com data e horário ao lado do campo. O campo inicia vazio em ambos os modos. Só o valor digitado entra na simulação; o Cloud continua exigindo uma dose manual independente para registrar uma aplicação.

O rascunho guarda todos os campos do formulário, inclusive a confirmação pendente e seu request ID. Cada alteração é escrita imediatamente, sem debounce, sob uma chave por modo, usuário e paciente. A confirmação bem-sucedida limpa o rascunho; erros e navegação não o limpam. Um aviso informa falhas de armazenamento. A recuperação é neste navegador, não entre dispositivos. Trata-se da exceção de armazenamento local solicitada para rascunhos, não de cache de registros clínicos confirmados nem de fila de aplicações offline.

No cadastro, os nutrientes são informados para a porção (por exemplo, 30 g de carboidratos em 200 g). A normalização mantém a base interna de 100 g. Uma unidade utiliza a porção cadastrada. Para ml ou utensílios, informe também o peso da porção: a conversão de volume para massa depende do alimento. Nutrientes desconhecidos permanecem ausentes.

## Medidas caseiras

Os pesos aproximados são do [Manual de Contagem de Carboidratos SBD 2023](https://diabetes.org.br/wp-content/uploads/2023/10/manual-contagem-carboidratos2023.pdf). Somente os pesos são aproveitados; os nutrientes continuam sendo os da [TACO 4ª edição, NEPA/UNICAMP](https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf), por 100 g comestíveis.

| Alimento TACO | Medida | Peso aproximado |
| --- | --- | --- |
| Arroz tipo 1 ou 2, cozido | Colher de sopa cheia / colher de servir | 20 g / 45 g |
| Arroz integral, cozido | Colher de sopa cheia | 20 g |
| Feijão carioca, cozido | Colher de sopa cheia / concha média rasa | 17 g / 80 g |
| Feijão preto, cozido | Colher de sopa cheia / concha média rasa / cheia | 17 g / 80 g / 140 g |
| Feijão fradinho, cozido | Colher de sopa cheia | 17 g |

Correspondências são explícitas por alimento e preparo. Não aplicamos os pesos a alimentos crus ou a receitas de mesmo nome. Outros alimentos podem ser cadastrados em colher, colher de sopa ou concha com seu peso informado. O cadastro não presume um peso universal para uma colher.

## Banco e exclusão

A migração `meal_portions_and_removal` acrescenta a porção aos alimentos e `deleted_at` às aplicações, além de uma RPC com SECURITY INVOKER e verificação de `can_write_patient`. Não remove registros existentes ou suas referências. A exclusão requer confirmação na interface e sai das consultas do histórico e dos gráficos; o trigger existente mantém a auditoria. Profissionais com acesso somente leitura não recebem a ação.

O teste SQL em `supabase/tests/meal_portions_and_removal.sql` usa dados temporários e rollback para verificar porções inválidas, isolamento de paciente, preservação do registro e auditoria.
