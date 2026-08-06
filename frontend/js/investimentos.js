import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarInvestimentos();
    } else {
        window.location.href = "cad.html";
    }
});

document.getElementById("btnSalvarInvestimento")?.addEventListener("click", adicionarInvestimento);

async function carregarInvestimentos() {
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/investimentos/${usuarioAtual.uid}`);
        if (res.ok) {
            const investimentos = await res.json();
            renderizarTabelaEResumo(investimentos);
        }
    } catch (erro) {
        console.error("Erro ao carregar investimentos:", erro);
    }
}

async function adicionarInvestimento() {
    const ticker = document.getElementById("invTicker").value.trim().toUpperCase();
    const tipo = document.getElementById("invTipo").value;
    const quantidade = parseInt(document.getElementById("invQuantidade").value);
    const precoMedio = parseFloat(document.getElementById("invPrecoMedio").value);

    if (!ticker || isNaN(quantidade) || quantidade <= 0 || isNaN(precoMedio) || precoMedio <= 0) {
        alert("Preencha todos os campos do ativo corretamente.");
        return;
    }

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
            document.getElementById("invTicker").value = "";
            document.getElementById("invQuantidade").value = "";
            document.getElementById("invPrecoMedio").value = "";
            carregarInvestimentos();
        }
    } catch (err) {
        alert("Erro ao salvar investimento.");
    }
}

async function removerInvestimento(id) {
    if (!confirm("Deseja remover este ativo da carteira?")) return;

    try {
        const res = await fetch(`/investimentos/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: usuarioAtual.uid })
        });

        if (res.ok) carregarInvestimentos();
    } catch (err) {
        alert("Erro ao remover ativo.");
    }
}

function renderizarTabelaEResumo(lista) {
    const tabela = document.getElementById("tabelaInvestimentos");
    let totalInvestido = 0;
    let totalAcoes = 0;
    let totalFIIs = 0;

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `<tr><td colspan="6">Nenhum ativo cadastrado. Adicione suas Ações ou FIIs acima.</td></tr>`;
        atualizarCards(0, 0, 0);
        desenharGraficoAlocacao(0, 0);
        return;
    }

    tabela.innerHTML = "";
    lista.forEach((item) => {
        const subtotal = item.quantidade * item.preco_medio;
        totalInvestido += subtotal;

        if (item.tipo === "Acao") totalAcoes += subtotal;
        else totalFIIs += subtotal;

        tabela.innerHTML += `
            <tr>
                <td><strong>${item.ticker}</strong></td>
                <td><span class="badge">${item.tipo}</span></td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.preco_medio.toFixed(2)}</td>
                <td>R$ ${subtotal.toFixed(2)}</td>
                <td>
                    <button class="btn-del" data-id="${item.id}">🗑️ Excluir</button>
                </td>
            </tr>
        `;
    });

    // Event listener para botões de exclusão dinâmicos
    document.querySelectorAll(".btn-del").forEach(btn => {
        btn.addEventListener("click", () => removerInvestimento(btn.dataset.id));
    });

    atualizarCards(totalInvestido, totalAcoes, totalFIIs);
    desenharGraficoAlocacao(totalAcoes, totalFIIs);
}

function atualizarCards(total, acoes, fiis) {
    document.getElementById("totalInvestido").innerText = `R$ ${total.toFixed(2)}`;
    // Exemplo simulado de variação de mercado (pode integrar com APIs reais da B3 no futuro)
    const estimativaAtual = total * 1.05; 
    const lucro = estimativaAtual - total;
    const pct = total > 0 ? (lucro / total) * 100 : 0;

    document.getElementById("valorAtual").innerText = `R$ ${estimativaAtual.toFixed(2)}`;
    document.getElementById("rendimento").innerText = `R$ ${lucro.toFixed(2)}`;
    
    const statusEl = document.getElementById("statusRendimento");
    statusEl.innerText = `+${pct.toFixed(2)}%`;
    statusEl.style.color = "#10B981";
}

function desenharGraficoAlocacao(acoes, fiis) {
    const canvas = document.getElementById("graficoInvestimentos");
    const chartExistente = Chart.getChart(canvas);
    if (chartExistente) chartExistente.destroy();

    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Ações (B3)", "Fundos Imobiliários (FIIs)"],
            datasets: [{
                data: [acoes, fiis],
                backgroundColor: ["#6FE7DD", "#F59E0B"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: "#8FA1A3" } }
            }
        }
    });
}