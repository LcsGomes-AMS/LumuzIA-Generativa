import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

// Aguarda a verificação do Firebase Auth antes de carregar os dados
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarDashboard();
        carregarGraficoGastos();
        carregarGraficoRendimento();
    } else {
        window.location.href = "cad.html";
    }
});

async function carregarDashboard() {
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/dashboard/${usuarioAtual.uid}`);
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

        const data = await res.json();

        document.getElementById("saldo").innerText = `R$ ${Number(data.saldo || 0).toFixed(2)}`;
        document.getElementById("receitas").innerText = `R$ ${Number(data.receitas || 0).toFixed(2)}`;
        document.getElementById("gastos").innerText = `R$ ${Number(data.gastos || 0).toFixed(2)}`;
    } catch (erro) {
        console.error("Erro ao carregar dados gerais do dashboard:", erro);
    }
}

async function carregarGraficoGastos() {
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/estatisticas/${usuarioAtual.uid}`);
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

        const dados = await res.json();
        const labels = dados.map(item => item.categoria);
        const valores = dados.map(item => item.total);

        // Paleta de cores moderna (Tema LumuzIA)
        const coresLumuzIA = [
            '#6FE7DD', // Ciano / Verde água
            '#F2A65A', // Laranja / Dourado
            '#E2685C', // Coral
            '#10B981', // Verde Esmeralda
            '#3B82F6', // Azul
            '#8B5CF6'  // Roxo
        ];

        const canvas = document.getElementById("graficoGastos");
        const chartExistente = Chart.getChart(canvas);
        if (chartExistente) chartExistente.destroy();

        new Chart(canvas, {
            type: "pie",
            data: {
                labels,
                datasets: [{ 
                    data: valores,
                    backgroundColor: coresLumuzIA,
                    borderColor: '#161E21',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right', // Posiciona a legenda à direita para centralizar o círculo
                        labels: { 
                            color: '#8FA1A3', 
                            font: { family: 'Inter', size: 12 },
                            padding: 12,
                            usePointStyle: true, // Bolinhas elegantes em vez de quadrados
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: R$ ${Number(context.raw).toFixed(2)}`
                        }
                    }
                }
            }
        });
    } catch (erro) {
        console.error("Erro ao carregar gráfico de gastos:", erro);
    }
}

async function carregarGraficoRendimento() {
    if (!usuarioAtual) return;

    try {
        // Busca os dados consolidados das APIs via Backend
        const res = await fetch(`/api/investimentos/cotacoes/${usuarioAtual.uid}`);
        
        let investido = 0;
        let atual = 0;
        let percentual = 0;
        let proventos = 0;

        if (res.ok) {
            const data = await res.json();
            investido = data.totalInvestido || 0;
            atual = data.valorAtual || 0;
            percentual = parseFloat(data.crescimentoPercentual) || 0;
            proventos = parseFloat(data.proximosProventos) || 0;
        }

        // 1. Cálculo do Rendimento em R$
        const valorRendimento = atual - investido;

        // 2. Lógica de Avaliação: Bom, Regular ou Ruim
        let statusTexto = "";
        let corStatus = "";

        if (percentual >= 8) {
            statusTexto = "Bom";
            corStatus = "#10B981"; // Verde
        } else if (percentual > 0) {
            statusTexto = "Regular";
            corStatus = "#F59E0B"; // Amarelo
        } else {
            statusTexto = "Ruim";
            corStatus = "#EF4444"; // Vermelho
        }

        // 3. Atualizar elementos no DOM
        const elPatrimonio = document.getElementById("patrimonioInvestido");
        const elRendimento = document.getElementById("rendimentos");
        const elStatus = document.getElementById("statusRendimento");
        const elProventos = document.getElementById("proximosProventos");

        if (elPatrimonio) elPatrimonio.innerText = `R$ ${atual.toFixed(2)}`;
        if (elRendimento) elRendimento.innerText = `R$ ${valorRendimento.toFixed(2)}`;
        if (elProventos) elProventos.innerText = `R$ ${proventos.toFixed(2)}`;

        if (elStatus) {
            elStatus.innerText = `${percentual >= 0 ? '+' : ''}${percentual.toFixed(2)}% (${statusTexto})`;
            elStatus.style.color = corStatus;
            elStatus.style.fontWeight = "bold";
        }

        // 4. Desenhar Gráfico com Histórico Real/Estimado
        const historico = [investido, investido * 1.01, investido * 1.02, atual];
        const labelsMeses = ["Aporte Inicial", "Mês 1", "Mês 2", "Atual"];

        const canvas = document.getElementById("graficoRendimento");
        const chartExistente = Chart.getChart(canvas);
        if (chartExistente) chartExistente.destroy();

        new Chart(canvas, {
            type: "line",
            data: {
                labels: labelsMeses,
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
                        ticks: { color: '#8FA1A3', font: { family: 'Inter', size: 12 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#8FA1A3',
                            font: { family: 'Inter', size: 11 },
                            callback: (value) => `R$ ${value}`
                        }
                    }
                }
            }
        });

    } catch (erro) {
        console.error("Erro ao carregar gráfico de rendimento:", erro);
    }
}