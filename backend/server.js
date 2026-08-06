const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const db = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "../frontend")
    )
);

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../frontend/index.html"
        )
    );
});

// =====================
// HELPER SCRAPING (Status Invest - Sem API)
// =====================
async function obterPrecoScraping(ticker) {
    try {
        const tickerUpper = ticker.toUpperCase();
        const url = `https://statusinvest.com.br/acoes/${tickerUpper}`;

        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        const $ = cheerio.load(data);
        const precoTexto = $('div[title="Valor atual do ativo"] strong.value').text();

        if (precoTexto) {
            const priceClean = precoTexto.replace(/\./g, "").replace(",", ".").trim();
            const price = parseFloat(priceClean);
            if (!isNaN(price)) return price;
        }
    } catch (error) {
        console.error(`Erro ao fazer scraping de ${ticker}:`, error.message);
    }
    return null;
}

// =====================
// PERFIL
// =====================
app.post("/perfil", (req, res) => {
    const { userId, nome, salario, meta, valorMeta } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: "userId obrigatório." });
    }

    db.run(
        `
        INSERT INTO users (id, nome, salario, meta, valor_meta)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            nome = excluded.nome,
            salario = excluded.salario,
            meta = excluded.meta,
            valor_meta = excluded.valor_meta
        `,
        [userId, nome, salario, meta, valorMeta],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true, userId });
        }
    );
});

// =====================
// RECEITAS
// =====================
app.post("/receitas", (req, res) => {
    const { userId, descricao, valor } = req.body;

    if (!userId || !descricao || valor == null) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    db.run(
        `
        INSERT INTO receitas (user_id, descricao, valor)
        VALUES (?, ?, ?)
        `,
        [userId, descricao, valor],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/receitas/:userId", (req, res) => {
    const { userId } = req.params;

    db.all("SELECT * FROM receitas WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.delete("/receitas/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    db.run("DELETE FROM receitas WHERE id = ? AND user_id = ?", [id, userId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.put("/receitas/:id", (req, res) => {
    const { id } = req.params;
    const { userId, descricao, valor } = req.body;

    db.run(
        "UPDATE receitas SET descricao = ?, valor = ? WHERE id = ? AND user_id = ?",
        [descricao, valor, id, userId],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// =====================
// GASTOS
// =====================
app.post("/gastos", (req, res) => {
    const { userId, descricao, valor, categoria } = req.body;

    if (!userId || !descricao || valor == null) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    db.run(
        `
        INSERT INTO gastos (user_id, descricao, valor, categoria)
        VALUES (?, ?, ?, ?)
        `,
        [userId, descricao, valor, categoria],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/gastos/:userId", (req, res) => {
    const { userId } = req.params;

    db.all("SELECT * FROM gastos WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.delete("/gastos/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    db.run("DELETE FROM gastos WHERE id = ? AND user_id = ?", [id, userId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.put("/gastos/:id", (req, res) => {
    const { id } = req.params;
    const { userId, descricao, valor, categoria } = req.body;

    db.run(
        "UPDATE gastos SET descricao = ?, valor = ?, categoria = ? WHERE id = ? AND user_id = ?",
        [descricao, valor, categoria, id, userId],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// =====================
// METAS
// =====================
app.post("/metas", (req, res) => {
    const { userId, nome, valorObjetivo, prazo } = req.body;

    if (!userId || !nome) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    db.run(
        `
        INSERT INTO metas (user_id, nome, valor_objetivo, prazo)
        VALUES (?, ?, ?, ?)
        `,
        [userId, nome, valorObjetivo, prazo],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/metas/:userId", (req, res) => {
    const { userId } = req.params;

    db.all("SELECT * FROM metas WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.delete("/metas/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    db.run("DELETE FROM metas WHERE id = ? AND user_id = ?", [id, userId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.put("/metas/:id", (req, res) => {
    const { id } = req.params;
    const { userId, nome, valorObjetivo, valorAtual, prazo } = req.body;

    db.run(
        "UPDATE metas SET nome = ?, valor_objetivo = ?, valor_atual = ?, prazo = ? WHERE id = ? AND user_id = ?",
        [nome, valorObjetivo, valorAtual, prazo, id, userId],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// =====================
// INVESTIMENTOS
// =====================
app.post("/investimentos", (req, res) => {
    const { userId, ticker, tipo, quantidade, precoMedio } = req.body;

    if (!userId || !ticker || !quantidade || !precoMedio) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    db.run(
        `INSERT INTO investimentos (user_id, ticker, tipo, quantidade, preco_medio)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, ticker, tipo, quantidade, precoMedio],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/investimentos/:userId", (req, res) => {
    const { userId } = req.params;

    db.all("SELECT * FROM investimentos WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.delete("/investimentos/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    db.run("DELETE FROM investimentos WHERE id = ? AND user_id = ?", [id, userId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// Cotação individual de ativo via Scraping
app.get("/api/cotacao/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const price = await obterPrecoScraping(ticker);

    if (price) {
        return res.json({ price });
    } else {
        return res.status(404).json({ error: "Preço não encontrado" });
    }
});

// Relatório completo da carteira com cotações
app.get("/api/investimentos/cotacoes/:userId", async (req, res) => {
    const { userId } = req.params;

    db.all("SELECT * FROM investimentos WHERE user_id = ?", [userId], async (err, ativos) => {
        if (err || !ativos || ativos.length === 0) {
            return res.json({
                totalInvestido: 0,
                valorAtual: 0,
                rendimento: 0,
                crescimentoPercentual: 0,
                proximosProventos: 0,
                detalhes: []
            });
        }

        let totalInvestido = 0;
        let valorAtualTotal = 0;
        let detalhes = [];

        for (const ativo of ativos) {
            const investidoAtivo = ativo.quantidade * ativo.preco_medio;
            totalInvestido += investidoAtivo;
            let precoAtual = ativo.preco_medio; // Fallback

            try {
                if (ativo.tipo === "Ação" || ativo.tipo === "FII") {
                    const priceScraped = await obterPrecoScraping(ativo.ticker);
                    if (priceScraped) precoAtual = priceScraped;
                }
            } catch (error) {
                console.error(`Erro ao buscar cotação de ${ativo.ticker}:`, error.message);
            }

            const valorAtualAtivo = ativo.quantidade * precoAtual;
            valorAtualTotal += valorAtualAtivo;

            detalhes.push({
                ticker: ativo.ticker,
                tipo: ativo.tipo,
                quantidade: ativo.quantidade,
                precoMedio: ativo.preco_medio,
                precoAtual: precoAtual,
                valorTotalAtual: valorAtualAtivo,
                lucroOuPrejuizo: valorAtualAtivo - investidoAtivo
            });
        }

        const rendimentoTotal = valorAtualTotal - totalInvestido;
        const crescimentoPercentual = totalInvestido > 0 ? (rendimentoTotal / totalInvestido) * 100 : 0;
        const estimativaProventos = valorAtualTotal * 0.007;

        res.json({
            totalInvestido,
            valorAtual: valorAtualTotal,
            rendimento: rendimentoTotal,
            crescimentoPercentual: crescimentoPercentual.toFixed(2),
            proximosProventos: estimativaProventos.toFixed(2),
            detalhes
        });
    });
});

// =====================
// DASHBOARD & ESTATÍSTICAS
// =====================
app.get("/dashboard/:userId", (req, res) => {
    const { userId } = req.params;

    db.get(
        `
        SELECT
        (SELECT IFNULL(SUM(valor),0) FROM receitas WHERE user_id = ?) AS receitas,
        (SELECT IFNULL(SUM(valor),0) FROM gastos WHERE user_id = ?) AS gastos
        `,
        [userId, userId],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({});
            }
            const receitas = row ? row.receitas : 0;
            const gastos = row ? row.gastos : 0;

            res.json({
                receitas,
                gastos,
                saldo: receitas - gastos
            });
        }
    );
});

app.get("/estatisticas/:userId", (req, res) => {
    const { userId } = req.params;

    db.all(
        `
        SELECT categoria, SUM(valor) AS total
        FROM gastos
        WHERE user_id = ?
        GROUP BY categoria
        `,
        [userId],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json([]);
            }
            res.json(rows);
        }
    );
});

// =====================
// CHAT IA (Ollama + Contexto)
// =====================
app.post("/chat", (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: "userId ou mensagem vazia" });
    }

    db.get(
        `SELECT 
            (SELECT IFNULL(SUM(valor), 0) FROM receitas WHERE user_id = ?) AS total_receitas,
            (SELECT IFNULL(SUM(valor), 0) FROM gastos WHERE user_id = ?) AS total_gastos`,
        [userId, userId],
        async (err, financeRow) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Erro ao buscar contexto financeiro." });
            }

            const receitas = financeRow ? financeRow.total_receitas : 0;
            const gastos = financeRow ? financeRow.total_gastos : 0;
            const saldo = receitas - gastos;

            db.all(`SELECT categoria, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY categoria`, [userId], async (err, categoriasRows) => {
                let resumoCategorias = "";
                if (!err && categoriasRows && categoriasRows.length > 0) {
                    resumoCategorias = categoriasRows.map(c => `- ${c.categoria}: R$ ${c.total.toFixed(2)}`).join("\n");
                }

                db.all(`SELECT ticker, tipo, quantidade, preco_medio FROM investimentos WHERE user_id = ?`, [userId], async (err, ativosRows) => {
                    let resumoInvestimentos = "";
                    let valorTotalInvestido = 0;

                    if (!err && ativosRows && ativosRows.length > 0) {
                        resumoInvestimentos = ativosRows.map(a => {
                            const subtotal = a.quantidade * a.preco_medio;
                            valorTotalInvestido += subtotal;
                            return `- ${a.ticker} (${a.tipo}): ${a.quantidade} cota(s) a R$ ${a.preco_medio.toFixed(2)} (Total: R$ ${subtotal.toFixed(2)})`;
                        }).join("\n");
                    }

                    const systemPrompt = `Você é a LumuzIA, uma assistente virtual de IA especializada em finanças pessoais e investimentos.
Seu tom de voz deve ser amigável, acolhedor e focado em educação financeira.

Aqui estão os dados financeiros ATUAIS e REAIS do usuário:
- Saldo em Conta: R$ ${saldo.toFixed(2)}
- Total de Receitas: R$ ${receitas.toFixed(2)}
- Total de Gastos: R$ ${gastos.toFixed(2)}
- Total Aplicado em Investimentos: R$ ${valorTotalInvestido.toFixed(2)}

Gastos por Categoria:
${resumoCategorias || "Nenhum gasto cadastrado ainda."}

Carteira de Investimentos (B3 & FIIs):
${resumoInvestimentos || "Nenhum ativo investido na carteira no momento."}

Use estritamente esses dados se o usuário perguntar sobre o saldo, investimentos ou situação financeira dele. Dê conselhos práticos e personalizados.`;

                    try {
                        const response = await axios.post("http://localhost:11434/api/generate", {
                            model: "llama3",
                            prompt: `${systemPrompt}\n\nUsuário: ${message}\nLumuzIA:`,
                            stream: false
                        });

                        res.json({ reply: response.data.response });

                    } catch (error) {
                        console.error(error.message);
                        res.status(500).json({ error: "Erro ao comunicar com Ollama. Verifique se ele está rodando." });
                    }
                });
            });
        }
    );
});

// =====================
// SERVIDOR
// =====================
app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});