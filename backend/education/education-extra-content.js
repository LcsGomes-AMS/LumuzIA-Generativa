"use strict";
// Conceitos duradouros; sem indicação de compra ou promessa de rentabilidade.
module.exports = {
    fundamentos: [
        ["Necessidade ou desejo", "Necessidades sustentam a vida diária; desejos podem ser planejados sem comprometer o essencial.", "Com dinheiro limitado, o que priorizar?", ["Alimentação e moradia", "Uma compra por impulso", "Uma assinatura sem uso"], 0],
        ["Custo de oportunidade", "Escolher um uso para o dinheiro significa abrir mão de outros usos possíveis.", "Comprar algo hoje pode adiar uma meta. Isso representa o quê?", ["Renda extra", "Custo de oportunidade", "Juro recebido"], 1],
        ["Poder de compra", "Se preços sobem e a renda fica igual, o mesmo dinheiro compra menos.", "Uma cesta passou de R$ 100 para R$ 110. Com R$ 100 você compra a mesma cesta?", ["Sim", "Não"], 1],
        ["Conferindo extratos", "Comparar registros com extratos ajuda a identificar cobranças desconhecidas e erros.", "Você encontra uma cobrança desconhecida. O que fazer?", ["Compartilhar sua senha", "Ignorar sempre", "Conferir e contatar a instituição por canal oficial"], 2]
    ],
    orcamento: [
        ["Despesas anuais", "Despesas previsíveis anuais podem ser provisionadas ao longo do ano.", "Uma despesa de R$ 1.200 vence em 12 meses. Quanto separar mensalmente, sem rendimentos?", ["R$ 100", "R$ 120", "R$ 200"], 0, "scenario"],
        ["Renda variável", "Quem tem renda variável precisa considerar meses de menor entrada e despesas essenciais.", "Qual base é mais prudente para compromissos fixos?", ["O melhor mês da história", "Uma estimativa conservadora da renda", "Todo o limite de crédito"], 1],
        ["Limite não é renda", "O limite do cartão é crédito: compras viram obrigações a pagar.", "Um limite de R$ 5.000 aumenta seu salário em R$ 5.000.", ["Verdadeiro", "Falso"], 1, "true-false"],
        ["Ajustando o mês", "Um déficit exige rever gastos, renda ou compromissos de forma realista.", "Entram R$ 2.500 e saem R$ 2.800. Qual o saldo?", ["R$ 300 positivos", "Zero", "R$ 300 negativos"], 2, "scenario"]
    ],
    "reserva-emergencia": [
        ["Reserva e renda instável", "Menor previsibilidade de renda pode exigir maior proteção para despesas essenciais.", "Quem deve avaliar uma reserva maior, mantidas as demais condições?", ["Quem tem renda muito instável", "Quem quer especular", "Ninguém precisa avaliar"], 0],
        ["Recompondo a reserva", "Depois de usar a reserva, planeje aportes compatíveis com seu orçamento.", "Após uma emergência, qual passo faz sentido?", ["Abandonar o planejamento", "Recompor a reserva gradualmente", "Dobrar o risco para recuperar rápido"], 1],
        ["Emergência ou previsão", "Uma despesa anual conhecida deve entrar no orçamento, pois não é inesperada.", "Uma taxa anual já conhecida deve ser planejada?", ["Sim", "Não"], 0],
        ["Começar pequeno", "Aportes pequenos e regulares ajudam a construir proteção ao longo do tempo.", "R$ 50 por mês durante seis meses, sem rendimentos, somam quanto?", ["R$ 250", "R$ 600", "R$ 300"], 2, "scenario"]
    ],
    dividas: [
        ["Inventário de dívidas", "Liste saldo devedor, custos, vencimentos e consequências de cada dívida.", "Qual informação ajuda a comparar dívidas?", ["Taxa, saldo e prazo", "A cor do contrato", "Apenas a propaganda"], 0],
        ["Parcela e custo total", "Parcela menor com prazo maior pode elevar o valor total pago.", "Uma parcela menor sempre significa menor custo total.", ["Verdadeiro", "Falso"], 1, "true-false"],
        ["Desconto à vista", "Compare o total parcelado com o preço à vista e preserve despesas essenciais.", "Dez parcelas de R$ 120 somam quanto?", ["R$ 1.020", "R$ 1.200", "R$ 120"], 1, "scenario"],
        ["Renegociação responsável", "Um acordo precisa caber no orçamento e ter condições claras.", "Antes de aceitar um acordo, o que verificar?", ["Só a urgência do vendedor", "Somente o nome do banco", "Custo total e capacidade de pagar"], 2]
    ],
    metas: [
        ["Valor que falta", "Desconte o valor já acumulado para calcular o esforço restante.", "Uma meta de R$ 5.000 já tem R$ 2.000. Quanto falta?", ["R$ 7.000", "R$ 3.000", "R$ 2.000"], 1, "scenario"],
        ["Prioridades", "Metas competem pelo mesmo orçamento; ordenar prioridades facilita decisões.", "Quando não dá para financiar todas as metas, o que ajuda?", ["Priorizar e ajustar prazos", "Ignorar contas essenciais", "Assumir qualquer empréstimo"], 0],
        ["Revisão de prazos", "Metas podem ser ajustadas quando a renda ou as necessidades mudam.", "Revisar uma meta após perder renda pode ser responsável.", ["Verdadeiro", "Falso"], 0, "true-false"],
        ["Acompanhamento", "Compare aportes previstos e realizados para corrigir a rota.", "Você planejou R$ 150 por mês e guardou R$ 100. Qual a diferença?", ["R$ 150", "R$ 250", "R$ 50"], 2, "scenario"]
    ],
    "renda-fixa": [
        ["Emissor e crédito", "O risco de crédito é a possibilidade de o emissor não honrar o pagamento.", "Qual situação representa risco de crédito?", ["O emissor não pagar", "Você organizar o extrato", "Você definir uma meta"], 0],
        ["Taxas e comparação", "Compare retornos na mesma base de tempo e considere custos e riscos.", "É adequado comparar diretamente uma taxa mensal com outra anual?", ["Sim", "Não, primeiro iguale a base de tempo"], 1],
        ["Resgate antecipado", "Vender antes do vencimento pode envolver condições e preços diferentes do esperado.", "Antes de resgatar antecipadamente, o que consultar?", ["Só a taxa original", "Regras de resgate e preço disponível", "Só o nome do produto"], 1],
        ["Rendimento nominal", "Rendimento nominal é o crescimento monetário antes de descontar a inflação.", "R$ 1.000 que viram R$ 1.100 tiveram qual ganho nominal em reais?", ["R$ 10", "R$ 1.100", "R$ 100"], 2, "scenario"]
    ],
    acoes: [
        ["Concentração", "Depender de uma única empresa aumenta a exposição a problemas específicos dela.", "Todo o patrimônio em uma empresa reduz risco específico?", ["Sim", "Não"], 1],
        ["Horizonte de investimento", "Recursos necessários em breve exigem atenção especial à volatilidade e liquidez.", "Dinheiro do aluguel do próximo mês combina com especulação em ações?", ["Não", "Sim, sempre"], 0],
        ["Preço e valor", "Uma ação com preço unitário baixo não é necessariamente barata em relação aos fundamentos.", "Uma ação de R$ 2 é automaticamente melhor que uma de R$ 50?", ["Sim", "Não"], 1],
        ["Custos da operação", "Taxas e outros custos podem reduzir o resultado de uma operação.", "Um ganho bruto de R$ 80 com R$ 10 de custos deixa quanto antes de outros encargos?", ["R$ 90", "R$ 80", "R$ 70"], 2, "scenario"]
    ],
    fiis: [
        ["Vacância", "Vacância significa imóveis ou espaços sem locatário, o que pode reduzir receitas.", "Um imóvel vazio pode afetar a receita de aluguel do fundo?", ["Sim", "Não"], 0],
        ["Concentração de locatários", "Receita concentrada em um locatário aumenta a dependência daquele contrato.", "Qual situação merece atenção?", ["Diversos contratos analisados", "Quase toda a renda vir de um só locatário", "Ler os relatórios"], 1],
        ["Leitura de relatórios", "Relatórios ajudam a entender estratégia, imóveis, contratos e riscos.", "Qual fonte ajuda a conhecer a carteira do fundo?", ["Uma promessa anônima", "Só um comentário em rede social", "Relatórios oficiais do fundo"], 2],
        ["Preço das cotas", "Mesmo quando há distribuição de rendimentos, a cota pode perder valor.", "Receber rendimentos impede queda no preço da cota.", ["Verdadeiro", "Falso"], 1, "true-false"]
    ],
    cripto: [
        ["Transferências", "Transferências para endereço ou rede incorretos podem causar perda de recursos.", "Antes de transferir, o que conferir?", ["Endereço e rede", "Só a foto do contato", "A promessa de retorno"], 0],
        ["Autenticação adicional", "Autenticação em dois fatores e senhas exclusivas ajudam a proteger contas.", "Qual prática melhora a segurança?", ["Reutilizar uma senha pública", "Usar senha exclusiva e autenticação adicional", "Enviar códigos a desconhecidos"], 1],
        ["Fraude por urgência", "Golpistas podem criar urgência para impedir que você verifique informações.", "Um desconhecido exige depósito imediato com lucro garantido. O que fazer?", ["Transferir sem conferir", "Enviar a frase de recuperação", "Interromper e verificar por fontes independentes"], 2],
        ["Queda percentual", "Após uma queda, o ganho percentual necessário para recuperar o valor pode ser maior.", "R$ 100 caem para R$ 50. Quanto precisam subir para voltar a R$ 100?", ["50%", "100%", "10%"], 1, "scenario"]
    ],
    diversificacao: [
        ["Correlação", "Ativos diferentes podem reagir de forma semelhante aos mesmos fatores de risco.", "Ter muitos ativos garante diversificação de riscos?", ["Sim, sempre", "Não, é preciso avaliar as exposições"], 1],
        ["Rebalanceamento", "Revisar a distribuição da carteira ajuda a alinhá-la aos objetivos e limites de risco.", "Qual é a finalidade do rebalanceamento?", ["Realinhar a distribuição ao plano", "Garantir lucro", "Eliminar todo risco"], 0],
        ["Mudanças de vida", "Novos dependentes, renda ou prazos podem mudar suas necessidades financeiras.", "Uma mudança importante de renda justifica rever o plano.", ["Verdadeiro", "Falso"], 0, "true-false"],
        ["Proteção contra promessas", "Nenhuma promessa substitui a avaliação de riscos e a verificação das informações.", "Qual atitude combina com um planejamento consciente?", ["Seguir qualquer dica urgente", "Concentrar tudo em retorno garantido", "Verificar informações e respeitar os próprios limites"], 2]
    ]
};
