function getUserId() {
    return localStorage.getItem("userId") || 1;
}

async function carregarDashboard() {
    const userId = getUserId();

    try {
        const res = await fetch(`/dashboard/${userId}`);
        const data = await res.json();

        document.getElementById("saldo").innerText = `R$ ${Number(data.saldo || 0).toFixed(2)}`;
        document.getElementById("receitas").innerText = `R$ ${Number(data.receitas || 0).toFixed(2)}`;
        document.getElementById("gastos").innerText = `R$ ${Number(data.gastos || 0).toFixed(2)}`;
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}

async function carregarGrafico() {
    const userId = getUserId();

    try {
        const res = await fetch(`/estatisticas/${userId}`);
        const dados = await res.json();

        const labels = dados.map(item => item.categoria);
        const valores = dados.map(item => item.total);

        new Chart(
            document.getElementById("graficoGastos"),
            {
                type: "pie",
                data: {
                    labels,
                    datasets: [
                        {
                            data: valores
                        }
                    ]
                }
            }
        );
    } catch (erro) {
        console.error("Erro ao carregar gráfico:", erro);
    }
}

carregarGrafico();
carregarDashboard();