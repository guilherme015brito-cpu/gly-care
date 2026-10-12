# Alertas de glicemia

O botão “Ativar alertas nesta sessão” no monitor também habilita notificações de hipo e hiperglicemia, mesmo sem horários de insulina basal. Usa os limites inferior e superior da faixa-alvo do paciente; os limites “muito baixa” e “muito alta” indicam agravamento. O painel exibe os limites e a leitura que motivou o aviso.

Somente a leitura mais recente do paciente é avaliada. Leituras com mais de 20 minutos, futuras, não numéricas, inválidas ou questionáveis não disparam alertas. Erros de consulta impedem avisos com dados em cache. O modo de demonstração só aceita leituras simuladas e identifica as notificações como demonstração; o Cloud não aceita simulações.

Cada leitura dispara no máximo uma vez por montagem do painel. Leituras novas na mesma faixa têm intervalo mínimo de 15 minutos. Mudança entre baixa/alta, agravamento e nova saída da faixa após recuperação podem avisar imediatamente. O controle fica apenas em memória, separado por paciente e modo. Ao sair do monitor ou atualizar, é preciso ativar novamente.

As notificações dependem da permissão e do suporte do navegador, e só são avaliadas enquanto o monitor está aberto e executando. Não há garantia com aplicativo fechado, celular bloqueado ou navegador suspenso. Este recurso não substitui alarmes do sensor. Nenhuma dose ou tratamento é calculado por estes alertas.

Não requer migração de banco. Testes cobrem limites, qualidade/frescura, recuperação, agravamento, repetição, isolamento, permissão e falhas na exibição.
