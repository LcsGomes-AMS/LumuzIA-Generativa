"use strict";

// Conteúdo oficial: respostas e recompensas nunca são entregues pelo arquivo estático.
const definitions = [
    ["fundamentos", "Fundamentos Financeiros", [
        ["O que é educação financeira?", "Conhecer seu dinheiro ajuda a decidir com consciência e planejar objetivos.", "Qual é o objetivo da educação financeira?", ["Enriquecer sem esforço", "Tomar decisões conscientes", "Nunca gastar"], 1],
        ["Receitas e despesas", "Receitas são entradas e despesas são saídas de dinheiro.", "Qual é uma receita?", ["Salário recebido", "Conta de luz", "Aluguel pago"], 0],
        ["Saldo", "Saldo é a diferença entre entradas e saídas no período.", "Você recebe R$ 3.000 e gasta R$ 2.600. Quanto sobra?", ["R$ 200", "R$ 300", "R$ 400", "R$ 500"], 2, "scenario"],
        ["Patrimônio", "Patrimônio líquido corresponde aos bens e direitos menos as dívidas.", "Bens de R$ 20 mil e dívidas de R$ 5 mil resultam em quanto de patrimônio líquido?", ["R$ 25 mil", "R$ 15 mil", "R$ 5 mil"], 1, "scenario"],
        ["Quiz: fundamentos", "Organização começa por conhecer entradas, saídas e compromissos.", "Registrar gastos pequenos também ajuda a entender o orçamento.", ["Verdadeiro", "Falso"], 0, "true-false"]
    ]],
    ["orcamento", "Orçamento", [
        ["Orçamento mensal", "Planeje com a renda líquida: o valor disponível depois dos descontos.", "Qual renda usar no planejamento?", ["Limite do cartão", "Renda líquida", "Um bônus incerto"], 1],
        ["Gastos fixos", "Gastos fixos se repetem com valores relativamente previsíveis.", "Qual é um exemplo de gasto fixo?", ["Aluguel mensal", "Viagem eventual", "Presente de aniversário"], 0],
        ["Gastos variáveis", "Gastos variáveis mudam conforme consumo e escolhas.", "Qual gasto costuma variar conforme o consumo?", ["Aluguel contratado", "Parcela fixa", "Conta de energia"], 2],
        ["Gastos supérfluos", "Diferencie necessidades de desejos e procure ajustes sustentáveis.", "O orçamento apertou. Qual ação pode ajudar?", ["Deixar de comprar remédios", "Rever assinaturas pouco usadas", "Ignorar as contas"], 1],
        ["Planejamento", "Reserve espaço para contas, objetivos e imprevistos antes de consumir o excedente.", "Se sobram R$ 300 e você poupa R$ 200, quanto resta para outros usos?", ["R$ 100", "R$ 200", "R$ 500"], 0, "scenario"],
        ["Quiz: orçamento", "Revise o orçamento quando a renda ou as despesas mudarem.", "Um orçamento deve ser revisado ao longo do tempo.", ["Verdadeiro", "Falso"], 0, "true-false"]
    ]],
    ["reserva-emergencia", "Reserva de Emergência", [
        ["O que é uma reserva?", "É um valor separado para despesas essenciais inesperadas.", "Qual é a função da reserva?", ["Especular no curto prazo", "Cobrir imprevistos", "Financiar compras por impulso"], 1],
        ["Objetivo da reserva", "A reserva reduz a dependência de crédito caro quando surge um imprevisto.", "Uma perda inesperada de renda pode justificar usar a reserva.", ["Verdadeiro", "Falso"], 0, "true-false"],
        ["Quanto guardar", "O valor depende do custo essencial e da estabilidade da renda. Meses de despesas são uma referência ajustável.", "Com custo essencial de R$ 2.000, quanto representam seis meses?", ["R$ 6.000", "R$ 8.000", "R$ 12.000"], 2, "scenario"],
        ["Onde guardar", "Para emergências, avalie baixo risco, liquidez e regras de resgate. Retornos elevados podem envolver riscos maiores.", "Qual característica priorizar para emergências?", ["Baixa liquidez", "Alta volatilidade", "Liquidez e baixo risco"], 2],
        ["Quando usar", "Use a reserva para imprevistos essenciais e planeje sua recomposição.", "Qual uso combina com a reserva?", ["Conserto urgente necessário para trabalhar", "Trocar um celular por desejo", "Comprar um ativo por impulso"], 0],
        ["Quiz: reserva", "Dinheiro para emergências deve estar acessível quando necessário.", "Uma reserva deve ficar obrigatoriamente bloqueada por muitos anos.", ["Verdadeiro", "Falso"], 1, "true-false"]
    ]],
    ["dividas", "Dívidas e Juros", [
        ["Juros simples e compostos", "Nos juros compostos, os juros incidem também sobre juros acumulados.", "R$ 100 com juros de 10% ao mês, por dois meses, sem pagamentos: qual o saldo?", ["R$ 110", "R$ 120", "R$ 121"], 2, "scenario"],
        ["Custo do crédito", "Compare o custo efetivo total, que reúne juros e outros custos do contrato.", "O que comparar ao contratar crédito?", ["Somente a parcela", "O custo efetivo total e o prazo", "A cor do cartão"], 1],
        ["Quiz: dívidas", "Negociar e priorizar dívidas caras pode reduzir o custo total.", "Pagar apenas o mínimo sempre elimina juros futuros.", ["Verdadeiro", "Falso"], 1, "true-false"]
    ]],
    ["metas", "Metas Financeiras", [
        ["Objetivo e prazo", "Uma meta clara define finalidade, valor e prazo.", "Qual meta está bem definida?", ["Poupar algum dia", "Juntar R$ 1.200 em 12 meses", "Ganhar muito"], 1],
        ["Aporte mensal", "Dividir o valor que falta pelo prazo oferece uma estimativa sem rendimentos.", "Quanto poupar por mês para juntar R$ 1.200 em 12 meses, sem rendimentos?", ["R$ 50", "R$ 100", "R$ 200"], 1, "scenario"],
        ["Quiz: metas", "Ajuste prazo e aporte à realidade do orçamento.", "Uma meta deve considerar sua capacidade de poupar.", ["Verdadeiro", "Falso"], 0, "true-false"]
    ]],
    ["renda-fixa", "Renda Fixa", [
        ["Risco e liquidez", "Renda fixa também envolve riscos de crédito, mercado e liquidez.", "Renda fixa é sempre livre de risco.", ["Verdadeiro", "Falso"], 1, "true-false"],
        ["Prazos e resgate", "Confira vencimento, disponibilidade de resgate, custos e condições antes de aplicar.", "O que verificar antes de investir?", ["Só a taxa anunciada", "Somente o nome", "Risco, prazo, liquidez e custos"], 2],
        ["Quiz: renda fixa", "Rentabilidade nominal não desconta a perda do poder de compra.", "O que reduz o poder de compra do dinheiro?", ["Inflação", "Organização", "Diversificação"], 0]
    ]],
    ["acoes", "Ações", [
        ["Participação em empresas", "Uma ação representa participação em uma empresa e seu preço pode oscilar.", "Ao comprar uma ação, você adquire o quê?", ["Rendimento garantido", "Participação em uma empresa", "Seguro contra perdas"], 1],
        ["Volatilidade", "Preços podem subir ou cair. Horizonte e tolerância a perdas precisam ser considerados.", "Uma ação pode perder valor após a compra.", ["Verdadeiro", "Falso"], 0, "true-false"],
        ["Quiz: ações", "Resultados passados não garantem resultados futuros.", "Uma valorização passada garante lucro futuro?", ["Sim", "Não"], 1]
    ]],
    ["fiis", "Fundos Imobiliários", [
        ["Cotas imobiliárias", "FIIs reúnem recursos para estratégias imobiliárias; cotas e rendimentos podem variar.", "Comprar uma cota de FII é o mesmo que ter rendimento fixo garantido?", ["Sim", "Não"], 1],
        ["Riscos dos fundos", "Vacância, inadimplência e condições de mercado podem afetar os resultados.", "Qual fator pode afetar um fundo de imóveis alugados?", ["Vacância dos imóveis", "A cor do aplicativo", "A senha do cotista"], 0],
        ["Quiz: FIIs", "Analise estratégia, riscos e custos; pagamentos anteriores não garantem pagamentos futuros.", "Rendimentos de um FII são sempre garantidos.", ["Verdadeiro", "Falso"], 1, "true-false"]
    ]],
    ["cripto", "Criptomoedas", [
        ["Ativos digitais", "Criptoativos podem ter alta volatilidade e riscos tecnológicos e de custódia.", "Qual risco deve ser considerado?", ["Ausência de oscilação", "Garantia de lucro", "Perdas por volatilidade e falhas de custódia"], 2],
        ["Custódia e golpes", "Nunca compartilhe chaves privadas ou frases de recuperação. Promessas de lucro garantido são sinal de alerta.", "É seguro enviar sua frase de recuperação a um suposto suporte?", ["Sim", "Não"], 1],
        ["Quiz: cripto", "Entenda o risco e a possibilidade de perda antes de alocar recursos.", "Uma promessa de retorno alto e garantido merece desconfiança.", ["Verdadeiro", "Falso"], 0, "true-false"]
    ]],
    ["diversificacao", "Diversificação e Planejamento", [
        ["Distribuição de riscos", "Distribuir recursos entre exposições diferentes pode reduzir riscos específicos, sem eliminar todas as perdas.", "Diversificar elimina qualquer risco?", ["Sim", "Não"], 1],
        ["Plano financeiro", "Conecte orçamento, reserva, dívidas, metas e investimentos aos seus prazos e necessidades.", "Qual atitude ajuda o planejamento?", ["Concentrar tudo por impulso", "Ignorar dívidas", "Revisar objetivos e capacidade financeira"], 2],
        ["Quiz final", "Aprender é contínuo: revise seu plano quando sua vida mudar e procure orientação qualificada quando necessário.", "Seu plano financeiro deve acompanhar mudanças de renda e objetivos.", ["Verdadeiro", "Falso"], 0, "true-false"]
    ]]
];
const tasks = [];
const modules = definitions.map(([id, title, lessons], index) => ({
    id, title, description: `Aprenda e pratique: ${title.toLowerCase()}.`, order: index + 1,
    tasks: lessons.map(([name, content, question, answers, correctAnswer, type], n) => {
        const taskId = `${id}-${String(n + 1).padStart(3, "0")}`;
        tasks.push({ id: taskId, moduleId: id, title: name, content, question, answers,
            correctAnswer, explanation: `${content} Resposta: ${answers[correctAnswer]}.`,
            type: type || "multiple-choice", xp: name.startsWith("Quiz") ? 20 : 10 });
        return taskId;
    })
}));
module.exports = { modules, tasks };
