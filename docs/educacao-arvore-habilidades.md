# Árvore de habilidades — 27/10/2026

A educação passa a usar um mapa horizontal com dez ramos, um por módulo. Cada ramo distribui habilidades em três linhas, mantendo a altura limitada mesmo com novas perguntas. O mapa pode ser arrastado com mouse, rolado por toque ou explorado pelos botões e pelas setas do teclado. “Minha próxima aula” localiza a próxima habilidade pendente.

As perguntas abrem em um `dialog` modal nativo, com fundo bloqueado, foco contido, fechamento por Escape e retorno do foco à habilidade. No celular o modal ocupa a tela inteira. Ao concluir uma pergunta, a seguinte abre no modal. Fechar uma aula não conclui a etapa nem concede XP.

O catálogo contém 78 perguntas em dez módulos, incluindo 40 novas questões sobre orçamento, reserva, dívidas, metas, renda fixa, ações, FIIs, criptoativos e diversificação. Conteúdo e gabaritos continuam no backend. IDs anteriores permanecem iguais; aulas concluídas continuam disponíveis para revisão mesmo quando uma nova antecessora foi adicionada. Novas perguntas são necessárias para concluir o catálogo expandido; certificados já emitidos permanecem armazenados.

Validação: 78 testes integrados e 20 cenários de interface. Foram incluídas verificações de integridade do catálogo, revisão de progresso antigo, mapa horizontal, arraste real com mouse, modal desktop, tela inteira no celular, teclado, desbloqueio, reload e conclusão com PDF.

Os ramos são uma representação visual da progressão existente, que continua sequencial e validada no servidor. A expansão não cria escolhas de especialização independentes nem usa dados financeiros reais nos exercícios.
