import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

// Aguarda a verificação do Firebase Auth antes de buscar os dados do dashboard
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarDashboard();
        carregarGrafico();
    } else {
        window.location.href = "cad.html";
    }
});

async function carregarDashboard() {
    if (!usuarioAtual) return;

    try {
        // Envia o UID do Firebase na URL do Dashboard
        const res = await fetch(`/dashboard/${usuarioAtual.uid}`);
        
        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const data = await res.json();

        document.getElementById("saldo").innerText = `R$ ${Number(data.saldo || 0).toFixed(2)}`;
        document.getElementById("receitas").innerText = `R$ ${Number(data.receitas || 0).toFixed(2)}`;
        document.getElementById("gastos").innerText = `R$ ${Number(data.gastos || 0).toFixed(2)}`;
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}

async function carregarGrafico() {
    if (!usuarioAtual) return;

    try {
        // Envia o UID do Firebase na URL de Estatísticas
        const res = await fetch(`/estatisticas/${usuarioAtual.uid}`);

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const dados = await res.json();

        const labels = dados.map(item => item.categoria);
        const valores = dados.map(item => item.total);

        // Destrói gráfico antigo se já existir (evita sobreposição no canvas)
        const canvas = document.getElementById("graficoGastos");
        const chartExistente = Chart.getChart(canvas);
        if (chartExistente) {
            chartExistente.destroy();
        }

        new Chart(canvas, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data: valores
                    }
                ]
            }
        });
    } catch (erro) {
        console.error("Erro ao carregar gráfico:", erro);
    }
}