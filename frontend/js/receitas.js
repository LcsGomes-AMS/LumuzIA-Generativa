async function salvarReceita() {
  const descricaoInput = document.getElementById("descricao");
  const valorInput = document.getElementById("valor");

  const descricao = descricaoInput.value.trim();
  const valor = parseFloat(valorInput.value);

  // Validação básica antes de enviar
  if (!descricao || isNaN(valor)) {
    alert("Por favor, preencha todos os campos corretamente.");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/receitas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        descricao,
        valor
      })
    });

    if (!res.ok) {
      throw new Error(`Erro no servidor: ${res.status}`);
    }

    const data = await res.json();

    // Limpa os campos e recarrega a lista
    descricaoInput.value = "";
    valorInput.value = "";
    carregarReceitas();

  } catch (erro) {
    console.error("Falha ao salvar receita:", erro);
    alert("Não foi possível salvar a receita. Verifique se o servidor está rodando.");
  }
}

async function carregarReceitas() {
  const tabela = document.getElementById("tabelaReceitas");

  try {
    const res = await fetch("http://localhost:3000/receitas");

    if (!res.ok) {
      throw new Error(`Erro na requisição: ${res.status}`);
    }

    const receitas = await res.json();

    // Constrói toda a string primeiro para atualizar a DOM uma única vez
    let linhasHtml = "";
    receitas.forEach(receita => {
      linhasHtml += `
        <tr>
          <td>${receita.descricao}</td>
          <td>R$ ${Number(receita.valor).toFixed(2)}</td>
        </tr>
      `;
    });

    tabela.innerHTML = linhasHtml;

  } catch (erro) {
    console.error("Falha ao carregar receitas:", erro);
    tabela.innerHTML = `<tr><td colspan="2">Erro ao carregar dados do servidor.</td></tr>`;
  }
}

// Inicializa a listagem ao carregar a página
carregarReceitas();