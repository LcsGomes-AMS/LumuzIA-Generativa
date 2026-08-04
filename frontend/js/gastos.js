function getUserId() {
    return localStorage.getItem("userId") || 1;
}

async function salvarGasto() {
    const descricao = document.getElementById("descricao").value.trim();
    const valor = parseFloat(document.getElementById("valor").value);
    const categoria = document.getElementById("categoria").value;
    const userId = getUserId();

    if (!descricao || isNaN(valor)) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    try {
        const res = await fetch("/gastos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId,
                descricao,
                valor,
                categoria
            })
        });

        const data = await res.json();

        if (data.success) {
            carregarGastos();
            document.getElementById("descricao").value = "";
            document.getElementById("valor").value = "";
        }
    } catch (erro) {
        console.error("Erro ao salvar gasto:", erro);
    }
}

async function carregarGastos() {
    const userId = getUserId();
    const tabela = document.getElementById("tabelaGastos");

    try {
        const res = await fetch(`/gastos/${userId}`);
        const gastos = await res.json();

        tabela.innerHTML = "";

        if (gastos.length === 0) {
            tabela.innerHTML = `<tr><td colspan="3">Nenhum gasto cadastrado.</td></tr>`;
            return;
        }

        gastos.forEach(gasto => {
            tabela.innerHTML += `
                <tr>
                    <td>${gasto.descricao}</td>
                    <td>R$ ${Number(gasto.valor).toFixed(2)}</td>
                    <td>${gasto.categoria}</td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar gastos:", erro);
    }
}

carregarGastos();