import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;
let simulacoes = [];

const TAXAS_PERFIL = {
    conservador: 9,
    moderado: 12,
    arrojado: 16
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarInvestimentos();
    } else {
        window.location.href = "cad.html";
    }
});

async function carregarInvestimentos() {
    if (!usuarioAtual) return;

    let investido = 0;
    let atual = 0;
    let historico = [0];
    let labelsMeses = ["Início"];

    try {
        const res = await fetch(`/investimentos/${usuarioAtual.uid}`);
        if (res.ok) {
            const data = await res.json();
            investido = data.totalInvestido || 0;
            atual = data.valorAtual || 0;
            if (data.historico) historico = data.historico;
            if (data.labels) labelsMeses = data.labels;
        }
    } catch (erro) {
        console.warn("Rota /investimentos não configurada no backend, exibindo valores zerados.");
    }

    const rendimento = atual - investido;
    const percentual = investido > 0 ? (rendimento / investido) * 100 : 0;

    document.getElementById("totalInvestido").innerText = `R$ ${investido.toFixed(2)}`;
    document.getElementById("valorAtual").innerText = `R$ ${atual.toFixed(2)}`;
    document.getElementById("rendimento").innerText = `R$ ${rendimento.toFixed(2)}`;

    const elStatus = document.getElementById("statusRendimento");
    let statusTexto = "Regular";
    let corStatus = "#F59E0B";

    if (percentual >= 8) {
        statusTexto = "Bom";
        corStatus = "#10B981";
    } else if (percentual <= 0) {
        statusTexto = "Ruim";
        corStatus = "#E2685C";
    }

    elStatus.innerText = `${percentual >= 0 ? "+" : ""}${percentual.toFixed(2)}% (${statusTexto})`;
    elStatus.style.color = corStatus;
    elStatus.style.fontWeight = "bold";

    desenharGraficoInvestimentos(labelsMeses, historico, corStatus);
}

function desenharGraficoInvestimentos(labels, historico, corStatus) {
    const canvas = document.getElementById("graficoInvestimentos");
    const chartExistente = Chart.getChart(canvas);
    if (chartExistente) chartExistente.destroy();

    new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Patrimônio (R$)",
                data: historico,
                borderColor: corStatus,
                backgroundColor: corStatus + "1F",
                fill: true,
                tension: 0.35,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: corStatus
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#8FA1A3", font: { family: "Inter", size: 12 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#8FA1A3",
                        font: { family: "Inter", size: 11 },
                        callback: (value) => `R$ ${value}`
                    }
                }
            }
        }
    });
}

function simularInvestimento() {
    const nome = document.getElementById("simNome").value.trim();
    const inicial = parseFloat(document.getElementById("simInicial").value) || 0;
    const mensal = parseFloat(document.getElementById("simMensal").value) || 0;
    const perfil = document.getElementById("simPerfil").value;
    const taxaInput = document.getElementById("simTaxa").value;
    const prazo = parseInt(document.getElementById("simPrazo").value);

    const taxa = taxaInput ? parseFloat(taxaInput) : TAXAS_PERFIL[perfil];

    if (!nome || isNaN(prazo) || prazo <= 0 || isNaN(taxa)) {
        alert("Preencha ao menos o nome e o prazo (em meses) corretamente.");
        return;
    }

    const taxaMensal = Math.pow(1 + taxa / 100, 1 / 12) - 1;
    let saldo = inicial;
    for (let m = 0; m < prazo; m++) {
        saldo = saldo * (1 + taxaMensal) + mensal;
    }

    const totalInvestidoSim = inicial + mensal * prazo;
    const rendimentoSim = saldo - totalInvestidoSim;

    simulacoes.push({
        nome,
        totalInvestido: totalInvestidoSim,
        valorFinal: saldo,
        rendimento: rendimentoSim,
        prazo,
        taxa
    });

    renderizarSimulacoes();

    document.getElementById("simNome").value = "";
    document.getElementById("simInicial").value = "";
    document.getElementById("simMensal").value = "";
    document.getElementById("simTaxa").value = "";
    document.getElementById("simPrazo").value = "";
}

function renderizarSimulacoes() {
    const tabela = document.getElementById("tabelaSimulacoes");

    if (simulacoes.length === 0) {
        tabela.innerHTML = `<tr><td colspan="6">Nenhuma simulação ainda. Preencha o formulário acima.</td></tr>`;
        return;
    }

    tabela.innerHTML = "";
    simulacoes.forEach((sim, index) => {
        tabela.innerHTML += `
            <tr>
                <td>${sim.nome}</td>
                <td>R$ ${sim.totalInvestido.toFixed(2)}</td>
                <td>R$ ${sim.valorFinal.toFixed(2)}</td>
                <td>R$ ${sim.rendimento.toFixed(2)} (${sim.taxa}% a.a.)</td>
                <td>${sim.prazo} meses</td>
                <td>
                    <button onclick="removerSimulacao(${index})">🗑️ Remover</button>
                </td>
            </tr>
        `;
    });
}

function removerSimulacao(index) {
    simulacoes.splice(index, 1);
    renderizarSimulacoes();
}

window.simularInvestimento = simularInvestimento;
window.removerSimulacao = removerSimulacao;
