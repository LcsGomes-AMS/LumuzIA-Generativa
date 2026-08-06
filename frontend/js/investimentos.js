import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        carregarInvestimentos();
    } else {
        window.location.href = "cad.html";
    }
});

// Manipular envio do formulário
document.getElementById("formInvestimento").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!usuarioAtual) return;

    const ticker = document.getElementById("ticker").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const quantidade = parseFloat(document.getElementById("quantidade").value);
    const precoMedio = parseFloat(document.getElementById("precoMedio").value);

    try {
        const res = await fetch("/investimentos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                ticker,
                tipo,
                quantidade,
                precoMedio
            })
        });

        if (res.ok) {
            document.getElementById("formInvestimento").reset();
            carregarInvestimentos();
        } else {
            alert("Erro ao salvar investimento.");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
    }
});

// Função auxiliar para buscar o Preço Real na API externa
// Função auxiliar para buscar o Preço Real na API externa
async function buscarPrecoReal(ticker, tipo, precoFallback) {
    try {
        if (tipo === "Ação" || tipo === "FII") {
            // Busca cotação no Backend Node.js
            const res = await fetch(`/api/cotacao/${ticker}`);
            if (!res.ok) return precoFallback;
            const data = await res.json();
            
            if (data && data.price) {
                return data.price;
            }
        } else if (tipo === "Cripto") {
            // Mapeamento de tickers de Cripto para CoinGecko
            let idCripto = ticker.toLowerCase();
            if (idCripto === "btc") idCripto = "bitcoin";
            if (idCripto === "eth") idCripto = "ethereum";
            if (idCripto === "sol") idCripto = "solana";

            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idCripto}&vs_currencies=brl`);
            if (!res.ok) return precoFallback;
            const data = await res.json();
            if (data[idCripto] && data[idCripto].brl) {
                return data[idCripto].brl;
            }
        }
    } catch (error) {
        console.warn(`Não foi possível carregar preço em tempo real de ${ticker}:`, error);
    }
    return precoFallback;
}

// Carregar e Renderizar a Tabela com Cotações em Tempo Real
async function carregarInvestimentos() {
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/investimentos/${usuarioAtual.uid}`);
        if (!res.ok) throw new Error("Erro ao carregar dados do servidor.");

        const investimentos = await res.json();
        const tabela = document.getElementById("tabelaInvestimentos");
        tabela.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #8FA1A3;">Buscando cotações reais na B3 e Cripto...</td></tr>`;

        let patrimonioTotal = 0;
        let custoTotal = 0;
        let htmlLinhas = "";

        // Processa as cotações em paralelo para maior rapidez
        const promessas = investimentos.map(async (item) => {
            const precoAtualReal = await buscarPrecoReal(item.ticker, item.tipo, item.preco_medio);
            const totalComprado = item.quantidade * item.preco_medio;
            const totalAtual = item.quantidade * precoAtualReal;
            const lucroPrejuizo = totalAtual - totalComprado;

            return {
                ...item,
                precoAtualReal,
                totalComprado,
                totalAtual,
                lucroPrejuizo
            };
        });

        const resultados = await Promise.all(promessas);
        tabela.innerHTML = "";

        resultados.forEach((item) => {
            patrimonioTotal += item.totalAtual;
            custoTotal += item.totalComprado;

            const corLucro = item.lucroPrejuizo >= 0 ? "#10B981" : "#EF4444";

            htmlLinhas += `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #6FE7DD;">${item.ticker}</td>
                    <td style="padding: 12px;">${item.tipo}</td>
                    <td style="padding: 12px;">${item.quantidade}</td>
                    <td style="padding: 12px;">R$ ${item.preco_medio.toFixed(2)}</td>
                    <td style="padding: 12px; font-weight: bold; color: #fff;">R$ ${item.precoAtualReal.toFixed(2)}</td>
                    <td style="padding: 12px; font-weight: bold;">R$ ${item.totalAtual.toFixed(2)}</td>
                    <td style="padding: 12px; color: ${corLucro}; font-weight: bold;">
                        ${item.lucroPrejuizo >= 0 ? '+' : ''}R$ ${item.lucroPrejuizo.toFixed(2)}
                    </td>
                    <td style="padding: 12px;">
                        <button onclick="deletarInvestimento(${item.id})" style="background: transparent; border: 1px solid #EF4444; color: #EF4444; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Excluir</button>
                    </td>
                </tr>
            `;
        });

        tabela.innerHTML = htmlLinhas || `<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhum ativo cadastrado.</td></tr>`;

        // Atualizar os Cards de Resumo da Carteira
        const lucroGeral = patrimonioTotal - custoTotal;
        const percentualGeral = custoTotal > 0 ? (lucroGeral / custoTotal) * 100 : 0;
        const proventosEstimados = patrimonioTotal * 0.007; // ~0.7% ao mês estimado

        document.getElementById("totalInvestido").innerText = `R$ ${patrimonioTotal.toFixed(2)}`;
        document.getElementById("lucroTotal").innerText = `R$ ${lucroGeral.toFixed(2)}`;
        document.getElementById("proventosEstimados").innerText = `R$ ${proventosEstimados.toFixed(2)}`;

        const elStatus = document.getElementById("percentualTotal");
        elStatus.innerText = `${percentualGeral >= 0 ? '+' : ''}${percentualGeral.toFixed(2)}%`;
        elStatus.style.color = lucroGeral >= 0 ? "#10B981" : "#EF4444";

    } catch (error) {
        console.error("Erro ao carregar lista de investimentos:", error);
    }
}

// Função de exclusão de ativo
window.deletarInvestimento = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este ativo?")) return;

    try {
        const res = await fetch(`/investimentos/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: usuarioAtual.uid })
        });

        if (res.ok) {
            carregarInvestimentos();
        }
    } catch (error) {
        console.error("Erro ao deletar investimento:", error);
    }
};