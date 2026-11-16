class_name FinancialEngine
extends RefCounted

## Motor de Cálculos e Princípios de Educação Financeira (Diretrizes BCB / CVM)

static func calcular_salario_liquido(salario_bruto: float) -> Dictionary:
	# Simulação simplificada de alíquotas oficiais (INSS e IRRF)
	var inss: float = 0.0
	if salario_bruto <= 1412.0:
		inss = salario_bruto * 0.075
	elif salario_bruto <= 2666.68:
		inss = (1412.0 * 0.075) + ((salario_bruto - 1412.0) * 0.09)
	else:
		inss = (1412.0 * 0.075) + ((2666.68 - 1412.0) * 0.09) + ((salario_bruto - 2666.68) * 0.12)
	
	var base_irrf: float = salario_bruto - inss
	var irrf: float = 0.0
	if base_irrf > 2259.20:
		irrf = (base_irrf * 0.075) - 169.44
	if irrf < 0.0:
		irrf = 0.0
		
	var liquido: float = salario_bruto - inss - irrf
	return {
		"bruto": salario_bruto,
		"inss": snapped(inss, 0.01),
		"irrf": snapped(irrf, 0.01),
		"liquido": snapped(liquido, 0.01)
	}

static func regra_50_30_20(renda_liquida: float) -> Dictionary:
	# Regra de ouro da gestão financeira pessoal
	return {
		"necessidades": snapped(renda_liquida * 0.50, 0.01), # 50% Gastos fixos e essenciais
		"desejos": snapped(renda_liquida * 0.30, 0.01),       # 30% Lazer, hobbies, estilo de vida
		"futuro": snapped(renda_liquida * 0.20, 0.01)         # 20% Reserva e investimentos
	}

static func simular_juros_rotativo_cartao(fatura: float, pagamento: float, meses: int = 6) -> Dictionary:
	# Taxa média do rotativo de cartão de crédito no Brasil ~ 14% ao mês
	var saldo_devedor: float = max(0.0, fatura - pagamento)
	var historico: Array[float] = []
	var taxa_mensal: float = 0.14
	var atual: float = saldo_devedor
	for m in range(meses):
		atual = atual * (1.0 + taxa_mensal)
		historico.append(snapped(atual, 0.01))
	return {
		"divida_inicial": saldo_devedor,
		"divida_final": snapped(atual, 0.01),
		"juros_pagos": snapped(atual - saldo_devedor, 0.01),
		"historico": historico
	}

static func simular_reserva_emergencia(gasto_mensal: float, meses: int = 6) -> float:
	# Reserva recomendada de 3 a 6 meses de despesas básicas
	return snapped(gasto_mensal * meses, 0.01)

static func juros_compostos(aporte_mensal: float, taxa_anual: float, anos: int) -> Dictionary:
	# Rendimento com aportes constantes e juros compostos
	var taxa_mensal: float = pow(1.0 + taxa_anual, 1.0 / 12.0) - 1.0
	var total_investido: float = 0.0
	var saldo: float = 0.0
	var meses: int = anos * 12
	for m in range(meses):
		saldo = (saldo + aporte_mensal) * (1.0 + taxa_mensal)
		total_investido += aporte_mensal
	var juros_gerados: float = saldo - total_investido
	return {
		"total_investido": snapped(total_investido, 0.01),
		"saldo_final": snapped(saldo, 0.01),
		"juros_gerados": snapped(juros_gerados, 0.01)
	}

