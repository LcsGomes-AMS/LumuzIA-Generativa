import { auth } from "./config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";


async function carregarDashboard(uid) {

    const res = await apiFetch(`/dashboard/${uid}`);

    if (res.status === 401) {
        window.location.href = "cad.html";
        return;
    }

    const data = await res.json();


    document.getElementById("saldo").innerText =
        `R$ ${(data.saldo || 0).toFixed(2)}`;

    document.getElementById("receitas").innerText =
        `R$ ${(data.receitas || 0).toFixed(2)}`;

    document.getElementById("gastos").innerText =
        `R$ ${(data.gastos || 0).toFixed(2)}`;
}



async function carregarInvestimentosResumo(uid) {

    const res = await apiFetch(
        `/api/investimentos/cotacoes/${uid}`
    );


    if (res.status === 401) {
        window.location.href = "cad.html";
        return;
    }


    const data = await res.json();


    const elPatrimonio =
        document.getElementById("patrimonioInvestido");

    const elRendimentos =
        document.getElementById("rendimentos");

    const elStatus =
        document.getElementById("statusRendimento");

    const elProventos =
        document.getElementById("proximosProventos");


    if (elPatrimonio) {

        elPatrimonio.innerText =
            `R$ ${(data.valorAtual || 0).toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2
                }
            )}`;

    }


    if (elRendimentos) {

        elRendimentos.innerText =
            `R$ ${(data.rendimento || 0).toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2
                }
            )}`;

    }


    if (elProventos) {

        elProventos.innerText =
            `R$ ${parseFloat(
                data.proximosProventos || 0
            ).toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2
                }
            )} (estimado)`;

        elProventos.title =
            "Valor estimado com base nos últimos proventos anunciados. Pode variar até a data de pagamento.";

    }


    if (elStatus) {

        const perc =
            parseFloat(
                data.crescimentoPercentual
            ) || 0;


        elStatus.innerText =
            `${perc >= 0 ? "+" : ""}${perc.toFixed(2)}%`;


        elStatus.style.color =
            perc >= 0
                ? "#10B981"
                : "#EF4444";

    }

}



async function carregarGraficoRendimento(uid) {

    const res = await apiFetch(
        `/api/investimentos/historico/${uid}`
    );


    if (res.status === 401) {
        window.location.href = "cad.html";
        return;
    }


    const historico = await res.json();


    const canvas =
        document.getElementById("graficoRendimento");


    if (
        !canvas ||
        !Array.isArray(historico) ||
        historico.length === 0
    ) {
        return;
    }


    const labels = historico.map(h => {

        const [ano, mes, dia] =
            h.data.split("-");

        return `${dia}/${mes}`;

    });


    new Chart(canvas, {

        type: "line",

        data: {

            labels,

            datasets: [

                {
                    label: "Valor da Carteira (R$)",

                    data:
                        historico.map(
                            h => h.valor_atual
                        ),

                    borderColor: "#6FE7DD",

                    backgroundColor:
                        "rgba(111, 231, 221, 0.15)",

                    fill: true,

                    tension: 0.3
                },


                {
                    label: "Rendimento (R$)",

                    data:
                        historico.map(
                            h => h.rendimento
                        ),

                    borderColor: "#10B981",

                    backgroundColor:
                        "rgba(16, 185, 129, 0.1)",

                    fill: true,

                    tension: 0.3
                }

            ]

        },


        options: {

            responsive: true,

            plugins: {

                legend: {

                    labels: {
                        color: "#fff"
                    }

                }

            },


            scales: {

                x: {
                    ticks: {
                        color: "#8FA1A3"
                    }
                },

                y: {
                    ticks: {
                        color: "#8FA1A3"
                    }
                }

            }

        }

    });

}



async function carregarGrafico(uid) {

    const res = await apiFetch(
        `/estatisticas/${uid}`
    );


    if (res.status === 401) {
        window.location.href = "cad.html";
        return;
    }


    const dados = await res.json();


    const canvas =
        document.getElementById("graficoGastos");


    if (!canvas || !Array.isArray(dados)) {
        return;
    }


    new Chart(canvas, {

        type: "pie",

        data: {

            labels:
                dados.map(
                    item => item.categoria
                ),

            datasets: [

                {
                    data:
                        dados.map(
                            item => item.total
                        )
                }

            ]

        }

    });

}



onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "cad.html";

        return;
    }


    try {

        await Promise.all([

            carregarDashboard(user.uid),

            carregarInvestimentosResumo(user.uid),

            carregarGraficoRendimento(user.uid),

            carregarGrafico(user.uid)

        ]);

        verificarParcelasPendentes();

    } catch (error) {

        console.error(
            "Erro ao carregar dashboard:",
            error
        );

    }

});