# Medidas caseiras e porções

Pesquisa consultada em 17–18/10/2026. As equivalências alteram somente o peso consumido. Carboidratos, proteínas, lipídios e energia continuam sendo os do alimento selecionado na TACO, por 100 g; valores ausentes continuam ausentes.

## Fontes e seleção

- [SBD — Manual de Contagem de Carboidratos 2023](https://diabetes.org.br/wp-content/uploads/2023/10/manual-contagem-carboidratos2023.pdf): ovos (p. 134), pães (136–137, 172), bananas (57–58), mamão (123), melancia/melão (126) e queijos (146–147). Os links na interface levam à página do PDF; a numeração física inclui a capa.
- [IBGE — POF 2008–2009, Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv50000.pdf): aveia, frutas e iogurtes. Cada medida informa o código do alimento da tabela para conferência.
- [TBCA — metodologia](https://www.tbca.net.br/): distingue volumes de utensílios e pesos, considerando densidade específica do alimento. Não foi usada para substituir os nutrientes TACO nem para presumir que 1 ml equivale a 1 g.

As correspondências estão em `src/lib/household-measures.ts`, por nome exato e preparo. Não se aplica uma colher genérica a qualquer alimento. Pesos de frutas referem-se à parte comestível; tamanho e cultivar variam. As referências genéricas de maçã, laranja, pera, uva e iogurte com sabor foram associadas às respectivas variedades TACO como aproximações, não como medições específicas de cada cultivar ou marca. Ovo cru e frito usam as linhas de preparo correspondentes do IBGE. O peso do ovo de codorna é uma equivalência de unidade, não uma troca de composição ou preparo.

## Funcionamento

- Registro de refeição e Plano alimentar usam a mesma conversão quantidade × peso da medida e mostram fonte e peso total.
- Cadastro aceita g, ml, unidade (un), fatia, colher, colher de sopa, colher de chá, concha, copo, xícara e pote. O peso cadastrado é o da porção inteira: 2 fatias/50 g significa 25 g por fatia. “Porção” continua representando as duas fatias.
- O peso de referência é aproximado; a opção **Personalizar medida** aceita o peso medido ou do rótulo. **Aplicar medida** associa esse peso ao item, mantendo sua composição por 100 g. Essa escolha é preservada no rascunho da refeição e no cardápio salvo. Campos ainda não aplicados no editor de personalização não alteram o item.
- Não foi encontrada uma equivalência suficientemente fundamentada para **concha de iogurte** nas referências consultadas. Há pote, copo e, no natural, colher de sopa rasa. Para concha, o usuário informa o peso da sua medida. Não se aproveitam pesos de coalhada, feijão ou água.
- Medidas caseiras consideram peso comestível. A opção de descontar casca/caroço/osso fica disponível somente ao informar gramas diretamente.
- Identificadores e pesos publicados devem permanecer estáveis: planos salvos referenciam esses identificadores. Novas revisões de equivalência precisam de outro identificador ou de migração explícita.

## Banco e compatibilidade

A migração `20261017211730_expand_household_measures.sql` amplia a restrição de unidades do catálogo e os identificadores aceitos pelo validador de cardápios. Mantém unidades antigas, políticas RLS, permissões e registros existentes. Deve ser aplicada antes da versão nova da interface. Não exige API paga nem coleta automática da TBCA.
