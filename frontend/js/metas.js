function getUserId() {
    return localStorage.getItem("userId") || 1;
}

async function salvarMeta() {
    const nome = document.getElementById("nome").value.trim();
    const valorObjetivo = parseFloat(document.getElementById("valorObjetivo").value);
    const prazo = parseInt(document.getElementById("prazo").value);
    const userId = getUserId();

    if (!nome || isNaN(valorObjetivo) || isNaN(prazo)) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    try {
        const res = await fetch("/metas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId,
                nome,
                valorObjetivo,
                prazo
            })
        });

        const data = await res.json();

        if (data.success) {
            carregarMetas();
            document.getElementById("nome").value = "";
            document.getElementById("valorObjetivo").value = "";
            document.getElementById("prazo").value = "";
        }
    } catch (erro) {
        console.error("Erro ao salvar meta:", erro);
    }
}

async function carregarMetas() {
    const userId = getUserId();
    const tabela = document.getElementById("tabelaMetas");

    try {
        const res = await fetch(`/metas/${userId}`);
        const metas = await res.json();

        tabela.innerHTML = "";

        if (metas.length === 0) {
            tabela.innerHTML = `<tr><td colspan="5">Nenhuma meta cadastrada.</td></tr>`;
            return;
        }

        metas.forEach(meta => {
            const progresso = (
                (meta.valor_atual / meta.valor_objetivo) * 100
            ).toFixed(1);

            tabela.innerHTML += `
                <tr>
                    <td>${meta.nome}</td>
                    <td>R$ ${Number(meta.valor_objetivo).toFixed(2)}</td>
                    <td>R$ ${Number(meta.valor_atual).toFixed(2)}</td>
                    <td>${meta.prazo} meses</td>
                    <td>${progresso}%</td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar metas:", erro);
    }
}

carregarMetas();