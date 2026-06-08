async function salvarReceita() {

    const descricao =
        document.getElementById("descricao").value;

    const valor =
        document.getElementById("valor").value;

    const res = await fetch(
        "http://localhost:3000/receitas",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                descricao,
                valor
            })
        }
    );

    const data = await res.json();

    if (data.success) {

        document.getElementById("descricao").value = "";
        document.getElementById("valor").value = "";

        carregarReceitas();

    }

}

async function carregarReceitas() {

    const res =
        await fetch(
            "http://localhost:3000/receitas"
        );

    const receitas =
        await res.json();

    const tabela =
        document.getElementById("tabelaReceitas");

    tabela.innerHTML = "";

    receitas.forEach(receita => {

        tabela.innerHTML += `
            <tr>
                <td>${receita.descricao}</td>
                <td>R$ ${Number(receita.valor).toFixed(2)}</td>
            </tr>
        `;

    });

}

carregarReceitas();