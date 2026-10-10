# Gly care

PROJETO: GLYCARE — Monitoramento de Diabetes Tipo 1



Desenvolva uma aplicação web progressiva (PWA), profissional, mobile-first, em português brasileiro, para acompanhamento familiar de uma paciente com diabetes mellitus tipo 1.



O sistema será utilizado principalmente pela mãe ou responsável da paciente, em um celular Android, com navegação extremamente simples, informações claras e excelente acessibilidade.



1. Stack tecnológica obrigatória



- React + TypeScript + Vite.

- Tailwind CSS + shadcn/ui.

- Lucide React para ícones.

- Recharts para gráficos.

- Supabase para autenticação, banco PostgreSQL e políticas de segurança.

- Estrutura compatível com hospedagem na Vercel.

- PWA instalável em Android.

- Código modular, tipado, organizado e preparado para manutenção posterior no GitHub e Codex.

- Não utilizar APIs pagas, serviços de IA ou serviços de assinatura sem necessidade.



Criar um projeto funcional, e não apenas telas estáticas.



2. Identidade visual



Nome provisório: GlyCare.



Estética moderna, minimalista, inspirada em aplicativos premium de saúde.



- Fundo predominantemente branco ou cinza muito claro.

- Verde-azulado como cor principal.

- Tipografia legível.

- Componentes com cantos arredondados.

- Cartões com sombra sutil.

- Excelente espaçamento.

- Indicadores de glicemia com cores auxiliares, mas nunca depender somente das cores para transmitir informação.

- Modo claro e escuro.

- Botões grandes para operação com uma mão.

- Layout otimizado para celulares de 360 a 430 pixels de largura.

- Barra de navegação inferior fixa, com três abas: Monitoramento, Alimentação e Configurações.



O aplicativo deve transmitir confiança e simplicidade, sem parecer um prontuário hospitalar complicado.



3. Autenticação e perfis



Implementar autenticação Supabase.



Tipos de usuário:



- Responsável/cuidador.

- Paciente.

- Profissional de saúde convidado, inicialmente apenas com acesso de leitura.



Permitir associar usuários autorizados a uma paciente.



Todos os dados clínicos deverão ficar protegidos por Row Level Security (RLS), com autorização baseada no vínculo entre usuário e paciente.



Nunca utilizar chave de serviço privilegiada no frontend.



Não utilizar dados pessoais ou clínicos reais na demonstração.



4. Aba Monitoramento



Criar um dashboard com:



Cartão principal de glicemia



- Glicemia atual em mg/dL.

- Seta de tendência: subida rápida, subida, estável, descida ou descida rápida, quando fornecida pela fonte.

- Data e horário da leitura.

- Identificação da origem: simulação, entrada manual ou integração externa.

- Indicador de sincronização.

- Mensagem clara para dados ausentes ou desatualizados.



Nunca apresentar dados simulados como dados reais.



Não inventar leituras intermediárias quando houver falha de conexão.



Gráfico



- Gráfico de glicemia.

- Filtros de 3 h, 6 h, 12 h, 24 h e 7 dias.

- Faixa-alvo individual configurável.

- Pontos de refeições.

- Marcadores de aplicações de insulina.

- Marcadores de cetonas registradas.

- Identificação dos dados importados e manuais.



Insulina administrada



Criar um cartão separado mostrando:



- Última insulina aplicada.

- Quantidade de unidades registrada.

- Data e horário.

- Tipo de insulina.

- Finalidade da aplicação.

- Histórico das últimas aplicações.



Criar um espaço reservado chamado "Insulina ativa (IOB)", mas não calcular valores clínicos nesta versão.



Exibir: "Estimativa de insulina ativa indisponível até validação do modelo farmacológico".



Não inferir IOB a partir do tempo de duração nominal da bula e não usar um decaimento linear simplificado.



Ações rápidas



- Registrar aplicação.

- Registrar glicemia manual.

- Registrar cetonas.

- Registrar refeição.

- Consultar histórico.



5. Aba Alimentação



Criar uma interface completa de pesquisa, seleção e registro de alimentos.



Busca de alimentos



- Campo de busca com sugestões.

- Listagem com nome do alimento, tipo de preparo e fonte.

- Entrada da quantidade em gramas.

- Possibilidade de selecionar vários alimentos para uma mesma refeição.

- Cadastro manual de alimentos.

- Cadastro de receitas caseiras.

- Refeições favoritas.



Contagem nutricional



Calcular automaticamente:



- Carboidratos totais.

- Proteínas.

- Gorduras.

- Calorias.



Usar os valores por 100 g dos alimentos e a quantidade informada pelo usuário.



Respeitar a unidade, parte comestível, estado cru/cozido e identificação da fonte de cada alimento.



Não inventar valores nutricionais ausentes.



Fontes de dados



Preparar integração futura com:



- TACO — Unicamp.

- TBCA — USP, condicionada às permissões de uso.



Enquanto não houver importação validada, utilizar poucos alimentos de exemplo claramente identificados como fictícios.



Criar uma estrutura que permita importar arquivos CSV ou JSON validados posteriormente.



Histórico de refeições



- Café da manhã.

- Almoço.

- Lanche.

- Jantar.

- Ceia.

- Outros.



Registrar horário, alimentos, quantidades, total de carboidratos e observações.



Mostrar a glicemia registrada próxima da refeição somente se houver uma leitura real válida, identificando seu horário e fonte.



No modo demonstração, calcular automaticamente o componente da refeição a partir dos carboidratos TACO e da relação por horário, somando a correção de glicemia configurada.



6. Modal Registrar Insulina



Criar uma tela ou modal de registro de aplicações.



Campos obrigatórios:



- Insulina utilizada, selecionada entre as cadastradas.

- Dose administrada em unidades internacionais (UI).

- Data e horário efetivos da aplicação.

- Tipo de aplicação: basal, refeição, correção ou combinação.

- Confirmação de que a aplicação realmente ocorreu.



Campos opcionais:



- Glicemia registrada antes da aplicação.

- Local da aplicação.

- Observações.

- Responsável pelo registro.



Requisitos:



- Diferenciar aplicação realizada de aplicação planejada.

- Não tratar registro como comprovação de que a dose foi realmente administrada.

- Permitir correção de registros com histórico de auditoria.

- Exigir confirmação ao registrar uma aplicação.

- Advertir sobre possível registro duplicado, sem apagar nem impedir automaticamente um registro legítimo.

- Não permitir doses negativas, valores não numéricos ou formatos inválidos.

- Os resultados demonstrativos não acionam aplicações de insulina. O registro de aplicações permanece um fluxo separado.



7. Cadastro de insulinas



Criar um catálogo administrável contendo:



- Nome comercial.

- Princípio ativo.

- Fabricante.

- Classe farmacológica.

- Concentração, como U-100 ou U-300.

- Via de administração.

- Apresentação.

- Início de ação.

- Pico de ação.

- Duração efetiva.

- Duração máxima.

- Fonte farmacológica.

- Data da revisão da fonte.

- Status de validação científica.



Os campos farmacológicos deverão admitir intervalos, valores desconhecidos e explicações textuais, não apenas números únicos.



Nunca confundir duração da ação com meia-vida plasmática.



Nunca assumir que marcas e apresentações diferentes possuem o mesmo perfil farmacológico.



Não preencher dados farmacológicos clínicos inventados.



Criar separadamente a lista de insulinas em uso pela paciente, incluindo dose e horários prescritos, permitindo registrar alterações do tratamento.



8. Configurações da paciente



Permitir cadastrar:



- Nome ou apelido.

- Data de nascimento, opcional.

- Glicemia-alvo prescrita.

- Faixas de referência individualizadas.

- Fator de sensibilidade prescrito.

- Relação insulina/carboidrato por faixa de horário.

- Tipo de insulina rápida.

- Tipo de insulina basal.

- Horários de administração.

- Instruções clínicas fornecidas pela equipe assistencial.

- Contato de emergência.

- Data da última revisão dos parâmetros.



No modo demonstração, esses parâmetros alimentam automaticamente as calculadoras de refeição e correção de glicemia.



Separar claramente informações prescritas de informações estimadas.



9. Cetonas e segurança



Implementar cadastro de cetonas:



- Tipo sanguíneo ou urinário.

- Valor e unidade compatíveis com o método.

- Data e horário.

- Observações.



Criar uma seção informativa sobre como consultar o plano de cuidados elaborado pelo endocrinologista em situações de hiperglicemia, hipoglicemia, doença ou suspeita de cetose.



Não inventar protocolos personalizados.



Não oferecer orientações automáticas de aplicar, aumentar, reduzir ou adiar insulina.



Não determinar automaticamente se a paciente deve comer ou esperar a glicemia baixar.



10. Integração futura com FreeStyle Libre



Criar arquitetura desacoplada para múltiplas fontes de glicemia.



Definir uma interface TypeScript GlucoseProvider, com adaptadores:



- MockGlucoseProvider.

- ManualGlucoseProvider.

- FutureLibreProvider.



O FutureLibreProvider deve ser somente uma interface preparada para implementação posterior.



Não implementar scraping, autenticação não oficial ou captura de credenciais da Abbott nesta etapa.



Cada leitura deve conter:



- Valor.

- Unidade.

- Timestamp da medição.

- Timestamp do recebimento.

- Fonte.

- Identificador externo, quando disponível.

- Tendência, quando disponível.

- Status de qualidade ou validade.



Rejeitar duplicidades de maneira idempotente.



Preservar os dados originais e suas unidades.



A PWA não deve alegar que consegue ler notificações de outros aplicativos Android.



11. Banco de dados Supabase



Projetar as tabelas:



- profiles

- patients

- patient_members

- insulin_catalog

- patient_insulins

- insulin_action_profiles

- insulin_administrations

- glucose_readings

- food_catalog

- meal_entries

- meal_items

- ketone_readings

- clinical_settings

- audit_logs



Criar chaves estrangeiras, índices para consultas por paciente e período, validações de unidade e restrições de integridade.



Ativar RLS em todas as tabelas contendo dados pessoais ou médicos.



Garantir que usuários não autorizados não possam acessar dados de pacientes de terceiros.



Nunca colocar dados clínicos verdadeiros diretamente no código.



Utilizar migrações SQL versionadas.



12. Experiência offline



Preparar PWA com instalação na tela inicial e armazenamento dos arquivos estáticos essenciais.



Se o dispositivo estiver offline:



- Mostrar claramente o estado da conexão.

- Permitir visualizar dados locais previamente disponibilizados, quando houver armazenamento seguro.

- Não fingir sincronização bem-sucedida.

- Não usar registros locais ainda não sincronizados como se estivessem confirmados no servidor.

- Não implementar cache persistente de dados clínicos sensíveis sem uma estratégia de segurança documentada.



13. Segurança e qualidade



- Componentes reutilizáveis.

- Tipagem TypeScript rigorosa.

- Validação de formulários com Zod.

- Estados de carregamento, erro e ausência de dados.

- Mensagens de erro compreensíveis.

- Acessibilidade para leitores de tela.

- Testes para cálculos nutricionais e validação de dados.

- Testes das políticas de autorização.

- Proteção de dados sensíveis de acordo com princípios da LGPD.

- Nenhum segredo no frontend.

- Nenhuma integração externa utilizando credenciais fixas.



O sistema não é um dispositivo médico validado e não deve se apresentar como substituto do sensor, glicosímetro, prescrição ou orientação médica.



14. Telas obrigatórias



1. Login e cadastro.

2. Dashboard de monitoramento.

3. Histórico de glicemia.

4. Registro de aplicação de insulina.

5. Histórico de aplicações.

6. Pesquisa e seleção de alimentos.

7. Composição de refeição.

8. Histórico alimentar.

9. Cadastro de insulinas.

10. Configurações e parâmetros da paciente.

11. Registro de cetonas.

12. Estado de conexão e integrações.



Manter apenas as três abas principais. As demais telas serão acessadas por botões e subpáginas.



15. Resultado esperado



Entregar um MVP visualmente completo, navegável e preparado para dados reais.



Quando não houver Supabase conectado, permitir apenas uma demonstração isolada, com marcação visível de dados simulados e sem persistência de informações clínicas reais.



Priorizar:



1. Interface mobile de alta qualidade.

2. Navegação funcional.

3. Cadastro e registro de insulinas.

4. Contagem nutricional.

5. Estrutura de dados segura.

6. Preparação para integração Libre.



Implementar as calculadoras automáticas de alimentação e monitoramento para o paciente fictício da demonstração, preservando a TACO, os nutrientes ausentes e as validações numéricas.



Não adicionar funcionalidades não solicitadas, chat de IA, pagamentos, assinaturas ou serviços externos.



Antes de implementar, apresentar uma arquitetura resumida. Em seguida, construir o MVP com o menor número possível de iterações.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a5c756db-437c-436c-9f88-88ac0754ad2b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Aplicativo GlyCare — deploy inicial
