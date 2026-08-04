// Função para obter o userId salvo no navegador (ou usar 1 como padrão)
function getUserId() {
  return localStorage.getItem("userId") || 1;
}

async function salvarReceita() {
  const descricaoInput = document.getElementById("descricao");
  const valorInput = document.getElementById("valor");

  const descricao = descricaoInput.value.trim();
  const valor = parseFloat(valorInput.value);
  const userId = getUserId(); // Pega o ID do usuário logado

  // Validação básica antes de enviar
  if (!descricao || isNaN(valor)) {
    alert("Por favor, preencha todos os campos corretamente.");
    return;
  }

  try {
    const res = await fetch("/receitas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId, // <-- Envia o ID exigido pelo banco
        descricao,
        valor
      })
    });

    if (!res.ok) {
      throw new Error(`Erro no servidor: ${res.status}`);
    }

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
  const userId = getUserId(); // Pega o ID do usuário logado

  try {
    // Busca apenas as receitas do usuário via Rota Relativa
    const res = await fetch(`/receitas/${userId}`);

    if (!res.ok) {
      throw new Error(`Erro na requisição: ${res.status}`);
    }

    const receitas = await res.json();

    if (receitas.length === 0) {
      tabela.innerHTML = `<tr><td colspan="2">Nenhuma receita cadastrada.</td></tr>`;
      return;
    }

    // Constrói a tabela
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