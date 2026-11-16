class_name MissionSystem
extends RefCounted

## Catálogo de Missões Educativas: A Vida Financeira de um Jovem Adulto

static func get_all_missions() -> Array[Dictionary]:
	return [
		{
			"id": 1,
			"title": "Missão 1: O Primeiro Salário (Bruto vs Líquido)",
			"npc": "Gerente de RH & Mentor",
			"description": "Você foi contratado! O salário nominal prometido é R$ 2.000,00. Mas ao abrir a conta no 5º dia útil, o saldo real é R$ 1.830,00 por conta dos descontos legais (INSS). Como você reage?",
			"learning": "O salário bruto é o valor registrado em contrato, mas o que realmente entra na sua conta é a Receita Líquida após deduções obrigatórias. Todo seu planejamento deve ser feito com base no valor líquido!",
			"choices": [
				{
					"text": "A) Comprar um tênis novo de R$ 600 parcelado em 6x, contando com os R$ 2.000.",
					"delta_balance": -100.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": -15,
					"delta_happiness": 10,
					"xp": 5,
					"feedback": "Cuidado! Você comprometeu seu orçamento com parcelas antes mesmo de pagar as contas essenciais do mês. O erro clássico de planejar em cima do salário bruto!"
				},
				{
					"text": "B) Acessar a LumuzIA, registrar a Receita Líquida real de R$ 1.830 e planejar o mês.",
					"delta_balance": 0.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": 25,
					"delta_happiness": 15,
					"xp": 30,
					"is_optimal": true,
					"feedback": "Excelente decisão! Planejar pela receita líquida evita dívidas e garante que suas contas essenciais caibam com folga no seu dinheiro disponível."
				}
			]
		},
		{
			"id": 2,
			"title": "Missão 2: Dominando a Regra 50/30/20",
			"npc": "Mentor LumuzIA",
			"description": "Com R$ 1.830 líquidos na mão, é hora de dividir suas despesas. Você precisa pagar alimentação, transporte e ajudar em casa, mas também quer sair no fim de semana.",
			"learning": "A regra 50/30/20 propõe destinar 50% para Necessidades (R$ 915), 30% para Desejos (R$ 549) e 20% para o Futuro / Poupança (R$ 366).",
			"choices": [
				{
					"text": "A) Gastar tudo o que sobrar das contas em festas e compras de impulso (sem guardar nada).",
					"delta_balance": -549.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": -20,
					"delta_happiness": 5,
					"xp": 5,
					"feedback": "Viver só pelo presente te deixa vulnerável a qualquer imprevisto. Sem guardar ao menos 10% a 20%, você nunca construirá segurança financeira."
				},
				{
					"text": "B) Aplicar a Regra 50/30/20: pagar o fixo (R$ 915), curtir com moderação (R$ 549) e guardar R$ 366.",
					"delta_balance": -915.0 - 549.0,
					"delta_emergency": 366.0,
					"delta_investment": 0.0,
					"delta_health": 30,
					"delta_happiness": 20,
					"xp": 35,
					"is_optimal": true,
					"feedback": "Perfeito! Você aproveitou o mês com lazer consciente e ainda construiu a base do seu futuro com R$ 366 guardados."
				}
			]
		},
		{
			"id": 3,
			"title": "Missão 3: A Armadilha do Cartão de Crédito",
			"npc": "Amigo Gastador & Banco",
			"description": "O banco aumentou seu limite de crédito para R$ 5.000,00! Seu amigo te convida para uma viagem caríssima com a galera: 'Joga tudo no cartão, depois a gente vê!'. A fatura vai passar do seu salário.",
			"learning": "O limite do cartão NÃO é renda extra. Se você não pagar a fatura integral, cai nos juros rotativos do cartão, que passam de 400% ao ano no Brasil — a dívida mais cara do país!",
			"choices": [
				{
					"text": "A) Ir na empolgação, parcelar a viagem e pagar o valor mínimo da fatura no mês seguinte.",
					"delta_balance": -250.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": -35,
					"delta_happiness": -15,
					"xp": 5,
					"feedback": "Alerta vermelho! O rotativo do cartão multiplicou seu saldo devedor. Os juros de 14% ao mês vão corroer seu salário pelos próximos meses!"
				},
				{
					"text": "B) Dizer 'não' para a viagem agora, ajustar o limite no app e usar o cartão só com valor já em conta.",
					"delta_balance": 0.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": 30,
					"delta_happiness": 15,
					"xp": 40,
					"is_optimal": true,
					"feedback": "Maturidade financeira nota 10! Dizer 'não' temporário para um desejo impulsivo protege sua paz e sua liberdade financeira."
				}
			]
		},
		{
			"id": 4,
			"title": "Missão 4: O Imprevisto e a Reserva de Segurança",
			"npc": "Técnico de Celular & Emergência",
			"description": "POW! Seu celular caiu no chão de tela para baixo e trincou inteirinho. Você usa o celular para trabalhar e estudar. O conserto urgente custa R$ 500,00 à vista.",
			"learning": "Imprevistos acontecem com 100% das pessoas. A Reserva de Emergência em títulos com liquidez diária (CDB 100% CDI ou Tesouro Selic) serve exatamente para isso: absorver choques sem entrar no cheque especial.",
			"choices": [
				{
					"text": "A) Usar cheque especial e pagar com juros de 8% ao mês porque não guardou nada.",
					"delta_balance": -600.0,
					"delta_emergency": 0.0,
					"delta_investment": 0.0,
					"delta_health": -30,
					"delta_happiness": -25,
					"xp": 5,
					"feedback": "Sem reserva, o imprevisto virou dívida cara e dor de cabeça. O cheque especial é uma das linhas de crédito mais caras do mercado."
				},
				{
					"text": "B) Utilizar a Reserva de Emergência com liquidez diária e depois repor a quantia no próximo mês.",
					"delta_balance": 0.0,
					"delta_emergency": -500.0,
					"delta_investment": 0.0,
					"delta_health": 25,
					"delta_happiness": 15,
					"xp": 40,
					"is_optimal": true,
					"feedback": "Missão cumprida com maestria! O imprevisto foi resolvido com tranquilidade, sem endividamento, porque sua reserva de segurança estava pronta."
				}
			]
		},
		{
			"id": 5,
			"title": "Missão 5: O Dinheiro Trabalha Por Você (Primeiros Investimentos)",
			"npc": "Mentor de Investimentos LumuzIA",
			"description": "Com suas contas em dia, dívidas zero e reserva de emergência estabelecida, sobraram R$ 400,00. É hora de dar seu primeiro passo no mundo dos investimentos para vencer a inflação!",
			"learning": "Deixar dinheiro parado na conta corrente ou na poupança perde poder de compra para a inflação (IPCA). Investir em títulos públicos (Tesouro Direto) e Renda Fixa atrelada ao CDI coloca os juros compostos para multiplicar seu patrimônio.",
			"choices": [
				{
					"text": "A) Deixar tudo na poupança tradicional ou comprar criptomoeda da moda por recomendação de influencer.",
					"delta_balance": -400.0,
					"delta_emergency": 0.0,
					"delta_investment": 200.0,
					"delta_health": -10,
					"delta_happiness": 0,
					"xp": 10,
					"feedback": "Cuidado com promessas de enriquecimento rápido ou investimentos abaixo da inflação! Antes de especular, entenda seu perfil e invista em ativos sólidos e regulados pela CVM."
				},
				{
					"text": "B) Aportar em Tesouro Selic e CDB com rendimento 100% CDI, iniciando sua jornada de longo prazo.",
					"delta_balance": -400.0,
					"delta_emergency": 0.0,
					"delta_investment": 400.0,
					"delta_health": 35,
					"delta_happiness": 30,
					"xp": 50,
					"is_optimal": true,
					"feedback": "Parabéns, investidor! Você deu o passo definitivo da liberdade financeira. Com aportes constantes e juros compostos, seu futuro está protegido e em crescimento constante!"
				}
			]
		}
	]

