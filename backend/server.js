const express = require("express");
const cors = require("cors");
const path = require("path");
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
// PERFIL
// =====================
app.post("/perfil", (req, res) => {
    const { nome, salario, meta, valorMeta } = req.body;

    db.run(
        `
        INSERT INTO users (nome, salario, meta, valor_meta)
        VALUES (?, ?, ?, ?)
        `,
        [nome, salario, meta, valorMeta],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

// =====================
// RECEITAS
// =====================
app.post("/receitas", (req, res) => {
    const { descricao, valor } = req.body;

    db.run(
        `
        INSERT INTO receitas (descricao, valor)
        VALUES (?, ?)
        `,
        [descricao, valor],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/receitas", (req, res) => {
    db.all("SELECT * FROM receitas ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

// =====================
// GASTOS
// =====================
app.post("/gastos", (req, res) => {
    const { descricao, valor, categoria } = req.body;

    db.run(
        `
        INSERT INTO gastos (descricao, valor, categoria)
        VALUES (?, ?, ?)
        `,
        [descricao, valor, categoria],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/gastos", (req, res) => {
    db.all("SELECT * FROM gastos ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

// =====================
// METAS
// =====================
app.post("/metas", (req, res) => {
    const { nome, valorObjetivo, prazo } = req.body;

    db.run(
        `
        INSERT INTO metas (nome, valor_objetivo, prazo)
        VALUES (?, ?, ?)
        `,
        [nome, valorObjetivo, prazo],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.get("/metas", (req, res) => {
    db.all("SELECT * FROM metas ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

// =====================
// DASHBOARD
// =====================
app.get("/dashboard", (req, res) => {
    db.get(
        `
        SELECT
        (SELECT IFNULL(SUM(valor),0) FROM receitas) AS receitas,
        (SELECT IFNULL(SUM(valor),0) FROM gastos) AS gastos
        `,
        [],
        (err, row) => {
            if (err) {
                return res.status(500).json({});
            }
            const receitas = row.receitas;
            const gastos = row.gastos;

            res.json({
                receitas,
                gastos,
                saldo: receitas - gastos
            });
        }
    );
});

// =====================
// ESTATÍSTICAS
// =====================
app.get("/estatisticas", (req, res) => {
    db.all(
        `
        SELECT categoria, SUM(valor) AS total
        FROM gastos
        GROUP BY categoria
        `,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json([]);
            }
            res.json(rows);
        }
    );
});

// =====================
// CHAT IA (Com Contexto Financeiro)
// =====================
app.post("/chat", (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Mensagem vazia" });
    }

    // 1. Busca saldo total
    db.get(
        `SELECT 
            (SELECT IFNULL(SUM(valor), 0) FROM receitas) AS total_receitas,
            (SELECT IFNULL(SUM(valor), 0) FROM gastos) AS total_gastos`,
        [],
        async (err, financeRow) => {
            if (err) {
                return res.status(500).json({ error: "Erro ao buscar contexto financeiro." });
            }

            const receitas = financeRow.total_receitas;
            const gastos = financeRow.total_gastos;
            const saldo = receitas - gastos;

            // 2. Busca gastos por categoria para dar detalhes à IA
            db.all(`SELECT categoria, SUM(valor) AS total FROM gastos GROUP BY categoria`, [], async (err, categoriasRows) => {
                let resumoCategorias = "";
                if (!err && categoriasRows) {
                    resumoCategorias = categoriasRows.map(c => `- ${c.categoria}: R$ ${c.total.toFixed(2)}`).join("\n");
                }

                // 3. Monta o prompt do sistema instruindo a IA com os dados reais
                const systemPrompt = `Você é a LumuzIA, uma assistente virtual de IA especializada em finanças pessoais.
Seu tom de voz deve ser amigável, acolhedor e focado em educação financeira.

Aqui estão os dados financeiros ATUAIS e REAIS do usuário:
- Saldo Atual: R$ ${saldo.toFixed(2)}
- Total de Receitas: R$ ${receitas.toFixed(2)}
- Total de Gastos: R$ ${gastos.toFixed(2)}

Gastos por Categoria:
${resumoCategorias || "Nenhum gasto cadastrado ainda."}

Use estritamente esses dados se o usuário perguntar sobre a situação financeira dele. Dê conselhos práticos de economia baseados no cenário dele.`;

                try {
                    // 4. Envia para o Ollama 3 local
                    const response = await fetch("http://localhost:11434/api/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "llama3",
                            prompt: `${systemPrompt}\n\nUsuário: ${message}\nLumuzIA:`,
                            stream: false
                        })
                    });

                    const data = await response.json();
                    res.json({ reply: data.response });

                } catch (error) {
                    console.error(error);
                    res.status(500).json({ error: "Erro ao comunicar com Ollama. Verifique se ele está rodando." });
                }
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