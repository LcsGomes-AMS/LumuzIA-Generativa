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
    const { userId, nome, salario, meta, valorMeta } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: "userId obrigatório." });
    }

    // Usa INSERT OR REPLACE para atualizar o perfil se o ID já existir no SQLite
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

// =====================
// DASHBOARD
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

// =====================
// ESTATÍSTICAS
// =====================
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
// CHAT IA (Com Contexto Financeiro Isolado por Usuário)
// =====================
app.post("/chat", (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: "userId ou mensagem vazia" });
    }

    // 1. Busca saldo total do usuário específico
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

            // 2. Busca gastos por categoria do usuário específico
            db.all(`SELECT categoria, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY categoria`, [userId], async (err, categoriasRows) => {
                let resumoCategorias = "";
                if (!err && categoriasRows) {
                    resumoCategorias = categoriasRows.map(c => `- ${c.categoria}: R$ ${c.total.toFixed(2)}`).join("\n");
                }

                // 3. Monta o prompt do sistema
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
                    // 4. Envia para o Ollama
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