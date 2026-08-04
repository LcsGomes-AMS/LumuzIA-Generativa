async function salvarMeta() {

    const nome =
        document.getElementById("nome").value;

    const valorObjetivo =
        document.getElementById("valorObjetivo").value;

    const prazo =
        document.getElementById("prazo").value;

    const res = await fetch(
        "http://localhost:3000/metas",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome,
                valorObjetivo,
                prazo
            })
        }
    );

    const data = await res.json();

    if(data.success){

        carregarMetas();

        document.getElementById("nome").value = "";
        document.getElementById("valorObjetivo").value = "";
        document.getElementById("prazo").value = "";

    }

}

async function carregarMetas(){

    const res =
        await fetch(
            "http://localhost:3000/metas"
        );

    const metas =
        await res.json();

    const tabela =
        document.getElementById("tabelaMetas");

    tabela.innerHTML = "";

    metas.forEach(meta => {

        const progresso =
            (
                (meta.valor_atual /
                meta.valor_objetivo)
                * 100
            ).toFixed(1);

        tabela.innerHTML += `
            <tr>
                <td>${meta.nome}</td>
                <td>R$ ${meta.valor_objetivo}</td>
                <td>R$ ${meta.valor_atual}</td>
                <td>${meta.prazo} meses</td>
                <td>${progresso}%</td>
            </tr>
        `;

    });

}

carregarMetas();