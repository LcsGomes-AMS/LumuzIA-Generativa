async function carregarDashboard(){

    const res =
        await fetch(
            "http://localhost:3000/dashboard"
        );

    const data =
        await res.json();

    document.getElementById("saldo")
        .innerText =
        `R$ ${data.saldo.toFixed(2)}`;

    document.getElementById("receitas")
        .innerText =
        `R$ ${data.receitas.toFixed(2)}`;

    document.getElementById("gastos")
        .innerText =
        `R$ ${data.gastos.toFixed(2)}`;

}
async function carregarGrafico(){

    const res =
        await fetch(
            "http://localhost:3000/estatisticas"
        );

    const dados =
        await res.json();

    const labels =
        dados.map(item => item.categoria);

    const valores =
        dados.map(item => item.total);

    new Chart(
        document.getElementById("graficoGastos"),
        {
            type:"pie",

            data:{
                labels,

                datasets:[
                    {
                        data: valores
                    }
                ]
            }
        }
    );

}

carregarGrafico();
carregarDashboard();