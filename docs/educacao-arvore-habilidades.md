# Árvore de habilidades — 27/10/2026

A educação usa um mapa horizontal com dez ramos, um por módulo. Nós compactos são posicionados por profundidade e conectados por linhas SVG diagonais, com estados de conclusão, disponibilidade e bloqueio. O mapa pode ser arrastado com mouse, rolado por toque ou explorado pelos botões e pelas setas do teclado. “Minha próxima aula” localiza a próxima habilidade pendente.

As perguntas abrem em um `dialog` modal nativo, com fundo bloqueado, foco contido, fechamento por Escape e retorno do foco à habilidade. No celular o modal ocupa a tela inteira. Ao concluir uma pergunta, a seguinte abre no modal. Fechar uma aula não conclui a etapa nem concede XP.

O catálogo contém 78 perguntas em dez módulos, incluindo 40 novas questões sobre orçamento, reserva, dívidas, metas, renda fixa, ações, FIIs, criptoativos e diversificação. Conteúdo e gabaritos continuam no backend. IDs anteriores permanecem iguais; aulas concluídas continuam disponíveis para revisão mesmo quando uma nova antecessora foi adicionada. Novas perguntas são necessárias para concluir o catálogo expandido; certificados já emitidos permanecem armazenados.

Validação: 78 testes integrados e 20 cenários de interface. Foram incluídas verificações de integridade do catálogo, revisão de progresso antigo, mapa horizontal, arraste real com mouse, modal desktop, tela inteira no celular, teclado, desbloqueio, reload e conclusão com PDF.

Cada habilidade libera até dois filhos; o servidor valida os pré-requisitos de cada nó. A raiz do módulo seguinte exige concluir todas as habilidades do anterior. Os caminhos filhos podem ser percorridos em ordens diferentes, mas todas as perguntas continuam obrigatórias para a conclusão. As linhas entre módulos partem das folhas anteriores. A expansão não usa dados financeiros reais nos exercícios.
