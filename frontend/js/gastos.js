async function salvarGasto() {

    const descricao =
        document.getElementById("descricao").value;

    const valor =
        document.getElementById("valor").value;

    const categoria =
        document.getElementById("categoria").value;

    const res = await fetch(
        "http://localhost:3000/gastos",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                descricao,
                valor,
                categoria
            })
        }
    );

    const data = await res.json();

    if(data.success){

        carregarGastos();

        document.getElementById("descricao").value="";
        document.getElementById("valor").value="";

    }

}

async function carregarGastos(){

    const res =
        await fetch(
            "http://localhost:3000/gastos"
        );

    const gastos =
        await res.json();

    const tabela =
        document.getElementById("tabelaGastos");

    tabela.innerHTML="";

    gastos.forEach(gasto=>{

        tabela.innerHTML += `
            <tr>
                <td>${gasto.descricao}</td>
                <td>R$ ${gasto.valor}</td>
                <td>${gasto.categoria}</td>
            </tr>
        `;

    });

}

carregarGastos();