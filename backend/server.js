if (process.env.NODE_ENV !== "test") require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { db, dbRun, dbGet, dbAll, dbTransaction, isPostgres } = require("./database");
const { verificarAutenticacao } = require("./firebaseAdmin");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { validateRequest, enforceQuota, bridgeConfig, MAX_VALUE } = require("./request-security");
const database = { dbRun, dbGet, dbAll };
const app = express();
app.disable("x-powered-by");
const proxyHops = process.env.TRUST_PROXY_HOPS || "0";
if (!/^[0-3]$/.test(proxyHops)) throw new Error("TRUST_PROXY_HOPS deve estar entre 0 e 3.");
app.set("trust proxy", Number(proxyHops));
const PORT = process.env.PORT || 3000;

// =========================================================================
// MIDDLEWARES DE SEGURANÇA E DURABILIDADE
// =========================================================================

// Proteção de Cabeçalhos HTTP com Helmet (mitiga Clickjacking, MIME sniffing, etc.)
app.use(helmet(require("./security-headers")));

// O limite por IP cobre todas as rotas, inclusive as financeiras fora de /api.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, limit: 3000, standardHeaders: "draft-8", legacyHeaders: false,
    message: { success: false, error: "Muitas requisições. Tente novamente em alguns minutos." }
}));
const limiterConta = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: req => req.uid,
    message: { success: false, error: "Muitas requisições. Tente novamente em alguns minutos." }
});
const limiterEscrita = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: req => req.uid,
    skip: req => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method),
    message: { success: false, error: "Limite de alterações atingido. Aguarde alguns minutos." }
});
const limiterChatIA = rateLimit({
    windowMs: 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: req => req.uid,
    message: { success: false, error: "Limite de mensagens no chat atingido. Aguarde 1 minuto." }
});

// Sem lista configurada, somente a origem da aplicação e desenvolvimento local.
const origensPermitidas = new Set((process.env.CORS_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean));
app.use(cors((req, callback) => {
    const origin = req.get("origin");
    const sameOrigin = origin === req.protocol + "://" + req.get("host");
    let localDev = false;
    try {
        const parsedOrigin = new URL(origin);
        localDev = process.env.NODE_ENV !== "production" && parsedOrigin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
    } catch { /* Origem inválida permanece bloqueada. */ }
    callback(null, {
        origin: !origin || sameOrigin || origensPermitidas.has(origin) || localDev,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"],
        credentials: false
    });
}));

app.use(express.json({ limit: "200kb" }));


// Middleware defensivo: intercepta JSON malformado e payload excessivo sem expor stack trace
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ success: false, error: "JSON malformado ou inválido no corpo da requisição." });
    }
    if (err.type === "entity.too.large" || err.status === 413) {
        return res.status(413).json({ success: false, error: "Tamanho de carga útil excede o limite permitido (200KB)." });
    }
    next(err);
});

// Garante que req.body seja sempre um objeto mesmo com Content-Type alternativo (ex: text/plain)
app.use((req, res, next) => {
    if (req.body === undefined || req.body === null) {
        req.body = {};
    }
    next();
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, "../frontend"), { index: false, dotfiles: "deny" }));

async function inserirLimitado(table, uid, sql, params) {
    return dbTransaction(async tx => {
        if (isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [uid]);
        await enforceQuota(tx, table, uid);
        return tx.dbRun(sql, params);
    });
}

// Helpers de validação de dados financeiros e durabilidade
function parseNumeroPositivo(val) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim().replace(",", ".");
    // Validação estrita: deve conter exclusivamente dígitos e ponto decimal válido
    if (!/^\d+(\.\d+)?$/.test(str)) {
        return null;
    }
    const num = parseFloat(str);
    return (!isNaN(num) && isFinite(num) && num > 0) ? num : null;
}

function sanitizarTexto(str, maxLen = 150) {
    if (!str || typeof str !== "string") return "";
    return str.trim().slice(0, maxLen);
}

// Helper para evitar violações de chave estrangeira ao cadastrar dados
async function garantirUsuarioExiste(userId) {
    if (!userId) return;
    await dbRun(`INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING`, [userId]);
}

// A marcação e o lançamento compartilham uma transação. A condição de estado
// no UPDATE protege também quando há mais de uma instância do servidor.
async function lancarAgendamento(id, userId, automatico = false) {
    return dbTransaction(async tx => {
        if (isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
        const ag = await tx.dbGet("SELECT * FROM agendamentos WHERE id = ? AND user_id = ?", [id, userId]);
        if (!ag) return null;
        if (ag.status === "lancado") return { ag, jaEstavaLancado: true };
        if (ag.status === "pendente_manual") {
            if (automatico) return null;
            await tx.dbRun("UPDATE agendamentos SET status = 'lancado' WHERE id = ? AND user_id = ? AND status = 'pendente_manual'", [id, userId]);
            return { ag };
        }
        if (ag.status !== "pendente" || !["gasto", "receita", "meta"].includes(ag.tipo)) return null;
        const claimed = await tx.dbRun("UPDATE agendamentos SET status = 'lancado' WHERE id = ? AND user_id = ? AND status = 'pendente'", [id, userId]);
        if (!claimed.changes) return { ag, jaEstavaLancado: true };
        if (ag.tipo === "gasto") {
            await enforceQuota(tx, "gastos", userId);
            await tx.dbRun("INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, ?, ?)", [userId, ag.descricao, ag.valor, ag.categoria || "Geral"]);
        } else if (ag.tipo === "receita") {
            await enforceQuota(tx, "receitas", userId);
            await tx.dbRun("INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)", [userId, ag.descricao, ag.valor]);
        } else {
            await enforceQuota(tx, "metas", userId);
            await tx.dbRun("INSERT INTO metas (user_id, nome, valor_objetivo, prazo) VALUES (?, ?, ?, ?)", [userId, ag.descricao, ag.valor, ag.prazo || 12]);
        }
        return { ag };
    });
}
async function processarAgendamentosPendentes(userId) {
    const hoje = new Date().toISOString().slice(0, 10);
    const pendentes = await dbAll("SELECT * FROM agendamentos WHERE user_id = ? AND status = 'pendente' AND data_agendada <= ? ORDER BY data_agendada ASC LIMIT 200", [userId, hoje]);
    const lancados = [];
    for (const ag of pendentes) {
        const result = await lancarAgendamento(ag.id, userId, true);
        if (result && !result.jaEstavaLancado) lancados.push(result.ag);
    }
    return lancados;
}

// Cache em memória para cotações (10 minutos de TTL)
const priceCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_PRICE_CACHE = 2000;
function cachePrice(key, value) {
    for (const [cachedKey, cached] of priceCache) {
        if (Date.now() - cached.timestamp >= (cached.ttl ?? CACHE_TTL)) priceCache.delete(cachedKey);
    }
    if (priceCache.size >= MAX_PRICE_CACHE) priceCache.delete(priceCache.keys().next().value);
    priceCache.set(key, value);
}
const pendingPrices = new Map();
async function obterPrecoAtivo(ticker, tipo) {
    const key = ticker + "_" + (tipo || "Ação");
    if (pendingPrices.has(key)) return pendingPrices.get(key);
    if (pendingPrices.size >= 12) return null;
    const request = buscarPrecoAtivo(ticker, tipo);
    pendingPrices.set(key, request);
    try { return await request; } finally { pendingPrices.delete(key); }
}
async function mapLimit(items, concurrency, mapper) {
    const output = new Array(items.length);
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (index < items.length) {
            const current = index++;
            output[current] = await mapper(items[current], current);
        }
    }));
    return output;
}


const https = require("https");

// Agente HTTPS padrão — valida certificados normalmente (rejectUnauthorized: true,
// que é o default). NUNCA desative essa validação globalmente: isso abre brecha
// para ataques man-in-the-middle em todas as chamadas externas (cotações e IA),
// incluindo o endpoint de IA que recebe saldo/receitas/gastos do usuário.
//
// Se algum provedor específico tiver certificado inválido/self-signed, trate
// esse caso isoladamente com um agente próprio só para ele — nunca globalmente.
const httpsAgent = new https.Agent({
    rejectUnauthorized: true
});

// Mapeamento de nomes/apelidos de cripto para o ID usado na CoinGecko
const MAPA_CRIPTO = Object.freeze({
    "BITCOIN": "bitcoin", "BTC": "bitcoin",
    "ETHEREUM": "ethereum", "ETH": "ethereum",
    "SOLANA": "solana", "SOL": "solana",
    "CARDANO": "cardano", "ADA": "cardano",
    "RIPPLE": "ripple", "XRP": "ripple",
    "DOGECOIN": "dogecoin", "DOGE": "dogecoin",
    "POLKADOT": "polkadot", "DOT": "polkadot",
    "TETHER": "tether", "USDT": "tether"
});

const BRAPI_TOKEN = process.env.BRAPI_TOKEN || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";

// Busca em UMA ÚNICA chamada o preço de todas as criptomoedas da carteira,
// e já deixa cada uma pronta no cache. Isso evita que a CoinGecko bloqueie
// por excesso de chamadas simultâneas quando há mais de uma cripto — o que
// acontecia antes (ex: Bitcoin falhando, Ethereum passando, de forma aleatória).
async function prefetchPrecosCripto(ativos) {
    const cryptoAtivos = ativos.filter(a => {
        const tickerUpper = (a.ticker || "").toUpperCase().trim();
        const isCrypto = (a.tipo || "").toUpperCase().includes("CRIPTO") || Object.hasOwn(MAPA_CRIPTO, tickerUpper);
        const cached = priceCache.get(tickerUpper + "_CRIPTO");
        return isCrypto && !(cached && Date.now() - cached.timestamp < (cached.ttl ?? CACHE_TTL));
    });
    if (!cryptoAtivos.length) return;
    const ids = [...new Set(cryptoAtivos.map(a => {
        const tickerUpper = a.ticker.toUpperCase().trim();
        return Object.hasOwn(MAPA_CRIPTO, tickerUpper) ? MAPA_CRIPTO[tickerUpper] : tickerUpper.toLowerCase();
    }))].sort();
    const key = "batch_" + ids.join(",");
    if (pendingPrices.has(key)) return pendingPrices.get(key);
    if (pendingPrices.size >= 12) return;
    const pending = (async () => {
        try {
            const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
                params: { ids: ids.join(","), vs_currencies: "brl" },
                headers: COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {},
                httpsAgent, timeout: 8000, maxRedirects: 0, maxContentLength: 256 * 1024
            });
            for (const ativo of cryptoAtivos) {
                const tickerUpper = ativo.ticker.toUpperCase().trim();
                const coinId = Object.hasOwn(MAPA_CRIPTO, tickerUpper) ? MAPA_CRIPTO[tickerUpper] : tickerUpper.toLowerCase();
                const price = Number(response?.data?.[coinId]?.brl);
                cachePrice(tickerUpper + "_CRIPTO", Number.isFinite(price) && price > 0
                    ? { price, timestamp: Date.now() }
                    : { price: null, timestamp: Date.now(), ttl: 60 * 1000 });
            }
        } catch {
            for (const ativo of cryptoAtivos) cachePrice(ativo.ticker.toUpperCase().trim() + "_CRIPTO", { price: null, timestamp: Date.now(), ttl: 60 * 1000 });
            console.warn("[COTAÇÃO] Provedor temporariamente indisponível.");
        }
    })();
    pendingPrices.set(key, pending);
    try { await pending; } finally { pendingPrices.delete(key); }
}

async function buscarPrecoAtivo(ticker, tipo) {
    if (!ticker) return null;

    const tickerUpper = ticker.toUpperCase().trim();
    const tipoUpper = (tipo || "").toUpperCase().trim();
    const ehCripto = tipoUpper.includes("CRIPTO") || Object.hasOwn(MAPA_CRIPTO, tickerUpper);
    const cacheKey = `${tickerUpper}_${ehCripto ? "CRIPTO" : tipoUpper}`;

    // 1. Cache
    if (priceCache.has(cacheKey)) {
        const cached = priceCache.get(cacheKey);
        if (Date.now() - cached.timestamp < (cached.ttl ?? CACHE_TTL)) {
            return cached.price;
        }
    }

    try {
        let price = null;

        if (ehCripto) {
            // CoinGecko: usa a chave Demo gratuita quando configurada, pra evitar
            // o limite de 5-15 chamadas/min do endpoint totalmente público.
            const idCoinGecko = Object.hasOwn(MAPA_CRIPTO, tickerUpper) ? MAPA_CRIPTO[tickerUpper] : tickerUpper.toLowerCase();

            const resposta = await axios.get(
                "https://api.coingecko.com/api/v3/simple/price",
                {
                    params: { ids: idCoinGecko, vs_currencies: "brl" },
                    headers: COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {},
                    httpsAgent,
                    timeout: 5000, maxRedirects: 0, maxContentLength: 256 * 1024
                }
            ).catch(() => null);

            const precoBrl = resposta?.data?.[idCoinGecko]?.brl;
            if (precoBrl) {
                price = parseFloat(precoBrl);
            }
        } else {
            // brapi.dev (API v2): feito especificamente para ações e FIIs da B3.
            // PETR4, VALE3, MGLU3 e ITUB4 funcionam sem token; qualquer
            // outro ticker exige o token gratuito em BRAPI_TOKEN.
            const url = "https://brapi.dev/api/v2/stocks/quote";
            const resposta = await axios.get(url, {
                params: {
                    symbols: tickerUpper,
                    ...(BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {})
                },
                httpsAgent,
                timeout: 5000, maxRedirects: 0, maxContentLength: 256 * 1024
            }).catch((err) => {
                if (err?.response?.status === 401 && !BRAPI_TOKEN) {
                    console.warn(`[COTAÇÃO AVISO] ${tickerUpper} exige token da brapi.dev. Configure BRAPI_TOKEN no ambiente.`);
                }
                return null;
            });

            const precoAtual = resposta?.data?.results?.[0]?.data?.regularMarketPrice;
            if (precoAtual) {
                price = parseFloat(precoAtual);
            }
        }

        if (Number.isFinite(price) && price > 0) {
            cachePrice(cacheKey, { price, timestamp: Date.now() });
            return price;
        }

        cachePrice(cacheKey, { price: null, timestamp: Date.now(), ttl: 60 * 1000 });
        console.warn("[COTAÇÃO] Preço temporariamente indisponível; usando preço médio.");
        return null;
    } catch (error) {
        console.error(`[COTAÇÃO ERRO] Falha geral em ${tickerUpper}:`, "INTERNAL");
        return null;
    }
}

// =====================
// ROTAS DE NAVEGAÇÃO
// =====================
app.get("/", (req, res) => {
    res.redirect("/cad.html");
});

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.use(verificarAutenticacao);
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
app.use(limiterConta);
app.use(limiterEscrita);
app.use("/api/ia/chat", limiterChatIA);
app.use(validateRequest);
app.use(["/api/cotacao", "/api/investimentos/cotacoes"], rateLimit({
    windowMs: 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: req => req.uid,
    message: { success: false, error: "Limite de cotações atingido. Aguarde 1 minuto." }
}));


// Diagnóstico limitado à conta autenticada, sem contagens globais.
app.get("/api/db-status", async (req, res) => {
    try {
        const counts = await Promise.all([
            dbGet("SELECT COUNT(*) AS total FROM receitas WHERE user_id = ?", [req.uid]),
            dbGet("SELECT COUNT(*) AS total FROM gastos WHERE user_id = ?", [req.uid]),
            dbGet("SELECT COUNT(*) AS total FROM metas WHERE user_id = ?", [req.uid])
        ]);
        res.json({ status: "online", persistente: isPostgres,
            contadores: { receitas: Number(counts[0]?.total || 0), gastos: Number(counts[1]?.total || 0), metas: Number(counts[2]?.total || 0) } });
    } catch { res.status(500).json({ success: false, error: "Erro interno no servidor." }); }
});

// =====================
// PERFIL
// =====================
app.post("/perfil", async (req, res) => {
    const userId = req.uid;
    const { nome, salario, meta, valorMeta } = req.body;

    try {
        await dbRun(
            `INSERT INTO users (id, nome, salario, meta, valor_meta)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                salario = excluded.salario,
                meta = excluded.meta,
                valor_meta = excluded.valor_meta`,
            [userId, nome || "", salario || 0, meta || "", valorMeta || 0]
        );
        res.json({ success: true, userId });
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json({ success: false, error: "Erro interno no servidor." });
    }
});

// =====================
// RECEITAS
// =====================
app.post("/receitas", async (req, res) => {
    const userId = req.uid;
    const { descricao, valor } = req.body;
    const descSanitizada = sanitizarTexto(descricao, 150);
    const numValor = parseNumeroPositivo(valor);

    if (!descSanitizada || numValor === null) {
        return res.status(400).json({ success: false, error: "Descrição válida e valor numérico positivo são obrigatórios." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await inserirLimitado("receitas", userId,
            `INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)`,
            [userId, descSanitizada, numValor]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cadastrar receita:", err.code || "INTERNAL");
        res.status(err.status === 409 ? 409 : 500).json({ success: false, error: "Erro ao cadastrar receita." });
    }
});

app.get("/receitas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM receitas WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json([]);
    }
});

app.delete("/receitas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM receitas WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar receita." });
    }
});

app.put("/receitas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { descricao, valor } = req.body;
    const descSanitizada = sanitizarTexto(descricao, 150);
    const numValor = parseNumeroPositivo(valor);

    if (isNaN(id) || !descSanitizada || numValor === null) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos ou valor não numérico." });
    }

    try {
        const result = await dbRun(
            "UPDATE receitas SET descricao = ?, valor = ? WHERE id = ? AND user_id = ?",
            [descSanitizada, numValor, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar receita." });
    }
});

// =====================
// GASTOS
// =====================
app.post("/gastos", async (req, res) => {
    const userId = req.uid;
    const { descricao, valor, categoria } = req.body;
    const descSanitizada = sanitizarTexto(descricao, 150);
    const numValor = parseNumeroPositivo(valor);
    const catSanitizada = sanitizarTexto(categoria, 50) || "Geral";

    if (!descSanitizada || numValor === null) {
        return res.status(400).json({ success: false, error: "Descrição válida e valor numérico positivo são obrigatórios." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await inserirLimitado("gastos", userId,
            `INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, ?, ?)`,
            [userId, descSanitizada, numValor, catSanitizada]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cadastrar gasto:", err.code || "INTERNAL");
        res.status(err.status === 409 ? 409 : 500).json({ success: false, error: "Erro ao cadastrar gasto." });
    }
});

app.get("/gastos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM gastos WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json([]);
    }
});

app.delete("/gastos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM gastos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar gasto." });
    }
});

app.put("/gastos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { descricao, valor, categoria } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }

    try {
        const result = await dbRun(
            "UPDATE gastos SET descricao = ?, valor = ?, categoria = ? WHERE id = ? AND user_id = ?",
            [descricao, valor, categoria, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar gasto." });
    }
});

// =====================
// ESTATÍSTICAS (gastos agrupados por categoria — alimenta o gráfico de pizza do Dashboard)
// =====================
app.get("/estatisticas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const { mes, ano, mesInicio, mesFim } = req.query;

    let filtro = "";
    let params = [req.uid];

    if (ano) {
        filtro = `AND strftime('%Y', created_at) = ?`;
        params = [req.uid, String(ano)];
    } else if (mesInicio && mesFim) {
        filtro = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        params = [req.uid, mesInicio, mesFim];
    } else {
        filtro = `AND strftime('%Y-%m', created_at) = ?`;
        params = [req.uid, mes || mesAtual];
    }

    try {
        const rows = await dbAll(
            `SELECT categoria, SUM(valor) AS total
             FROM gastos
             WHERE user_id = ? ${filtro}
             GROUP BY categoria
             ORDER BY total DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar estatísticas de gastos:", "INTERNAL");
        res.status(500).json([]);
    }
});

// =====================
// METAS
// =====================
app.post("/metas", async (req, res) => {
    const userId = req.uid;
    const { nome, valorObjetivo, prazo } = req.body;
    const nomeSanitizado = sanitizarTexto(nome, 100);
    const numObjetivo = parseNumeroPositivo(valorObjetivo);
    const numPrazo = parseInt(prazo, 10);

    if (!nomeSanitizado || numObjetivo === null || isNaN(numPrazo) || numPrazo <= 0) {
        return res.status(400).json({ success: false, error: "Nome, valor objetivo positivo e prazo em meses são obrigatórios." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await inserirLimitado("metas", userId,
            `INSERT INTO metas (user_id, nome, valor_objetivo, prazo) VALUES (?, ?, ?, ?)`,
            [userId, nomeSanitizado, numObjetivo, numPrazo]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cadastrar meta:", err.code || "INTERNAL");
        res.status(err.status === 409 ? 409 : 500).json({ success: false, error: "Erro ao cadastrar meta." });
    }
});

app.get("/metas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM metas WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json([]);
    }
});

app.delete("/metas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM metas WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar meta." });
    }
});

app.put("/metas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nome, valorObjetivo, valorAtual, prazo } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }

    try {
        const result = await dbRun(
            "UPDATE metas SET nome = ?, valor_objetivo = ?, valor_atual = ?, prazo = ? WHERE id = ? AND user_id = ?",
            [nome, valorObjetivo, valorAtual, prazo, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar meta." });
    }
});

app.get("/metas/estimativa/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const receitasPorMes = await dbAll(
            `SELECT strftime('%Y-%m', created_at) AS mes, SUM(valor) AS total FROM receitas WHERE user_id = ? GROUP BY mes`,
            [req.uid]
        );
        const gastosPorMes = await dbAll(
            `SELECT strftime('%Y-%m', created_at) AS mes, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY mes`,
            [req.uid]
        );

        const mesesSet = new Set([
            ...receitasPorMes.map(r => r.mes),
            ...gastosPorMes.map(g => g.mes)
        ]);
        const numMeses = mesesSet.size || 1;

        const totalReceitas = receitasPorMes.reduce((s, r) => s + (r.total || 0), 0);
        const totalGastos = gastosPorMes.reduce((s, g) => s + (g.total || 0), 0);

        const mediaMensal = (totalReceitas - totalGastos) / numMeses;

        res.json({ mediaMensal, baseMeses: numMeses });
    } catch (err) {
        console.error("Erro ao calcular estimativa:", "INTERNAL");
        res.status(500).json({ mediaMensal: 0, baseMeses: 0 });
    }
});

// =====================
// AGENDAMENTOS
// =====================
app.post("/agendamentos", async (req, res) => {
    const userId = req.uid;
    const { tipo, descricao, valor, categoria, prazo, dataAgendada } = req.body;

    if (!tipo || !descricao || valor == null || !dataAgendada) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }
    if (!["gasto", "receita", "meta"].includes(tipo)) {
        return res.status(400).json({ success: false, error: "Tipo inválido." });
    }

    try {
        await garantirUsuarioExiste(userId);
        const result = await inserirLimitado("agendamentos", userId,
            `INSERT INTO agendamentos (user_id, tipo, descricao, valor, categoria, prazo, data_agendada)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, tipo, descricao, valor, categoria || null, prazo || null, dataAgendada]
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        console.error("Erro ao criar agendamento:", "INTERNAL");
        res.status(err.status === 409 ? 409 : 500).json({ success: false, error: "Erro ao criar agendamento." });
    }
});

app.get("/agendamentos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        await processarAgendamentosPendentes(req.uid);

        const rows = await dbAll(
            "SELECT * FROM agendamentos WHERE user_id = ? ORDER BY data_agendada ASC",
            [req.uid]
        );
        res.json(rows.map(row => row.status === "pendente_manual"
            ? { ...row, status: "pendente" }
            : row));
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json([]);
    }
});

app.get("/agendamentos/processar/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const lancados = await processarAgendamentosPendentes(req.uid);
        res.json({ lancados });
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json({ lancados: [] });
    }
});

app.patch("/agendamentos/:id/pago", async (req, res, next) => {
    try {
        const result = await lancarAgendamento(Number(req.params.id), req.uid);
        if (!result) return res.status(404).json({ success: false, error: "Agendamento não encontrado." });
        res.json({ success: true, jaEstavaLancado: Boolean(result.jaEstavaLancado) });
    } catch (err) { next(err); }
});

app.patch("/agendamentos/:id/pendente", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun(
            "UPDATE agendamentos SET status = CASE WHEN status = 'lancado' THEN 'pendente_manual' ELSE status END WHERE id = ? AND user_id = ?",
            [id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Agendamento não encontrado." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar status." });
    }
});

app.delete("/agendamentos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM agendamentos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar agendamento." });
    }
});

// =====================
// INVESTIMENTOS
// =====================
app.post("/investimentos", async (req, res, next) => {
    const userId = req.uid;
    const { ticker, tipo, quantidade, precoMedio, dataCompra } = req.body;
    try {
        const result = await dbTransaction(async tx => {
            await tx.dbRun("INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING", [userId]);
            if (isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
            await enforceQuota(tx, "aportes", userId);
            const existente = await tx.dbGet("SELECT * FROM investimentos WHERE user_id = ? AND ticker = ? LIMIT 1", [userId, ticker]);
            if (!existente) await enforceQuota(tx, "investimentos", userId);
            const qtdAtual = Number(existente?.quantidade || 0), pmAtual = Number(existente?.preco_medio || 0);
            const qtdTotal = qtdAtual + quantidade, custoTotal = qtdAtual * pmAtual + quantidade * precoMedio;
            if (!Number.isFinite(qtdTotal) || !Number.isFinite(custoTotal) || qtdTotal > MAX_VALUE || custoTotal > MAX_VALUE) {
                throw Object.assign(new Error("Limite do investimento excedido."), { status: 400 });
            }
            await tx.dbRun("INSERT INTO aportes (user_id, ticker, tipo, quantidade, preco_unitario, data) VALUES (?, ?, ?, ?, ?, ?)", [userId, ticker, tipo, quantidade, precoMedio, dataCompra]);
            if (existente) {
                const novoPrecoMedio = custoTotal / qtdTotal;
                await tx.dbRun("UPDATE investimentos SET quantidade = ?, preco_medio = ?, tipo = ? WHERE id = ? AND user_id = ?", [qtdTotal, novoPrecoMedio, tipo, existente.id, userId]);
                return { id: existente.id, atualizado: true, quantidade: qtdTotal, precoMedio: novoPrecoMedio };
            }
            const inserted = await tx.dbRun("INSERT INTO investimentos (user_id, ticker, tipo, quantidade, preco_medio, data_compra) VALUES (?, ?, ?, ?, ?, ?)", [userId, ticker, tipo, quantidade, precoMedio, dataCompra]);
            return { id: inserted.lastID, atualizado: false };
        });
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

app.get("/investimentos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM investimentos WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error("[BACKEND] Falha interna:", err.code || "INTERNAL");
        res.status(500).json([]);
    }
});

app.delete("/investimentos/:id", async (req, res, next) => {
    try {
        const result = await dbTransaction(async tx => {
            if (isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [req.uid]);
            return tx.dbRun("DELETE FROM investimentos WHERE id = ? AND user_id = ?", [Number(req.params.id), req.uid]);
        });
        if (!result.changes) return res.status(404).json({ success: false, error: "Ativo não encontrado." });
        res.json({ success: true, message: "Ativo excluído com sucesso." });
    } catch (err) { next(err); }
});

app.get("/api/cotacao/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const tipo = req.query.tipo || "Ação";
    const price = await obterPrecoAtivo(ticker, tipo);

    if (price !== null) {
        return res.json({ price });
    } else {
        return res.status(404).json({ error: "Preço não encontrado" });
    }
});

app.get("/api/investimentos/cotacoes/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    const userId = req.uid;

    try {
        // Não zera o cache aqui: o TTL de 10 minutos (CACHE_TTL) já cuida de
        // expirar preços antigos. Limpar tudo a cada reload forçava chamadas
        // novas à brapi/CoinGecko com muita frequência, esbarrando nos limites
        // de requisições dessas APIs gratuitas.

        const ativos = await dbAll("SELECT * FROM investimentos WHERE user_id = ?", [userId]);

        if (!ativos || ativos.length === 0) {
            return res.json({
                totalInvestido: 0,
                valorAtual: 0,
                rendimento: 0,
                crescimentoPercentual: "0.00",
                proximosProventos: "0.00",
                detalhes: []
            });
        }

        // Busca todas as criptos da carteira numa única chamada, evitando
        // que a CoinGecko bloqueie por chamadas simultâneas.
        await prefetchPrecosCripto(ativos);

        let totalInvestido = 0;
        let valorAtualTotal = 0;

        const cotacoesDeadline = Date.now() + 15000;
        const detalhes = await mapLimit(ativos, 6, async (ativo) => {
                const qtd = parseFloat(ativo.quantidade) || 0;
                const pm = parseFloat(ativo.preco_medio) || 0;
                const investidoAtivo = qtd * pm;

                const cotado = Date.now() < cotacoesDeadline ? await obterPrecoAtivo(ativo.ticker, ativo.tipo) : null;
                const precoAtual = (cotado && cotado > 0) ? cotado : pm;
                const valorAtualAtivo = qtd * precoAtual;

                totalInvestido += investidoAtivo;
                valorAtualTotal += valorAtualAtivo;

                return {
                    id: ativo.id,
                    ticker: ativo.ticker,
                    tipo: ativo.tipo,
                    quantidade: qtd,
                    precoMedio: pm,
                    precoAtual: precoAtual,
                    valorTotalAtual: valorAtualAtivo,
                    lucroOuPrejuizo: valorAtualAtivo - investidoAtivo,
                    dataCompra: ativo.data_compra || null
                };
            });

        const rendimentoTotal = valorAtualTotal - totalInvestido;
        const crescimentoPercentual = totalInvestido > 0 ? (rendimentoTotal / totalInvestido) * 100 : 0;

        const hoje = new Date().toISOString().split("T")[0];
        await dbRun(
            `INSERT INTO historico_patrimonio (user_id, data, valor_investido, valor_atual, rendimento)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, data) DO UPDATE SET
                valor_investido = excluded.valor_investido,
                valor_atual = excluded.valor_atual,
                rendimento = excluded.rendimento`,
            [userId, hoje, totalInvestido, valorAtualTotal, rendimentoTotal]
        );

        for (const item of detalhes) {
            await dbRun(
                `INSERT INTO historico_ativos (user_id, ticker, data, valor_investido, valor_atual, rendimento)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, ticker, data) DO UPDATE SET
                    valor_investido = excluded.valor_investido,
                    valor_atual = excluded.valor_atual,
                    rendimento = excluded.rendimento`,
                [userId, item.ticker, hoje, item.quantidade * item.precoMedio, item.valorTotalAtual, item.lucroOuPrejuizo]
            );
        }

        res.json({
            totalInvestido,
            valorAtual: valorAtualTotal,
            rendimento: rendimentoTotal,
            crescimentoPercentual: crescimentoPercentual.toFixed(2),
            proximosProventos: (valorAtualTotal * 0.007).toFixed(2),
            detalhes
        });
    } catch (err) {
        console.error("Erro na rota de cotações:", "INTERNAL");
        res.status(500).json({ error: "Erro ao processar cotações." });
    }
});

app.get("/api/investimentos/historico/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            "SELECT data, valor_investido, valor_atual, rendimento FROM historico_patrimonio WHERE user_id = ? ORDER BY data ASC",
            [req.uid]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar histórico:", "INTERNAL");
        res.status(500).json([]);
    }
});

app.get("/api/investimentos/historico-ativo/:userId/:ticker", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            "SELECT data, valor_investido, valor_atual, rendimento FROM historico_ativos WHERE user_id = ? AND ticker = ? ORDER BY data ASC",
            [req.uid, req.params.ticker.toUpperCase()]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar histórico do ativo:", "INTERNAL");
        res.status(500).json([]);
    }
});

// =====================
// IA / OLLAMA E CHAT
// =====================

app.post("/api/chat/conversas", async (req, res, next) => {
    try {
        const conversa = await dbTransaction(async tx => {
            await tx.dbRun("INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING", [req.uid]);
            if (isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [req.uid]);
            await enforceQuota(tx, "chat_conversas", req.uid);
            const inserted = await tx.dbRun("INSERT INTO chat_conversas (user_id, titulo) VALUES (?, ?)", [req.uid, req.body.titulo]);
            return tx.dbGet("SELECT * FROM chat_conversas WHERE id = ? AND user_id = ?", [inserted.lastID, req.uid]);
        });
        res.json({ success: true, conversa });
    } catch (err) { next(err); }
});

app.get("/api/chat/conversas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM chat_conversas WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar conversas:", "INTERNAL");
        res.status(500).json([]);
    }
});

app.get("/api/chat/conversas/:userId/:conversaId/mensagens", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            "SELECT * FROM chat_mensagens WHERE conversa_id = ? AND user_id = ? ORDER BY id ASC",
            [req.params.conversaId, req.uid]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar mensagens:", "INTERNAL");
        res.status(500).json([]);
    }
});

app.delete("/api/chat/conversas/:userId/:conversaId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        await dbRun("DELETE FROM chat_conversas WHERE id = ? AND user_id = ?", [req.params.conversaId, req.uid]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao deletar conversa:", "INTERNAL");
        res.status(500).json({ success: false, error: "Erro ao deletar conversa." });
    }
});

const activeChatUsers = new Set();
const MAX_ACTIVE_CHATS = 8;
app.post("/api/ia/chat", async (req, res, next) => {
    const userId = req.uid;
    const { prompt, conversaId } = req.body;
    let acquired = false;
    try {
        if (conversaId) {
            const owned = await dbGet("SELECT id FROM chat_conversas WHERE id = ? AND user_id = ?", [conversaId, userId]);
            if (!owned) return res.status(404).json({ success: false, error: "Conversa não encontrada." });
        }
        const bridge = bridgeConfig();
        if (!bridge) return res.status(503).json({ success: false, error: "Assistente indisponível. Verifique a configuração do servidor." });
        if (activeChatUsers.has(userId) || activeChatUsers.size >= MAX_ACTIVE_CHATS) {
            res.set("Retry-After", "5");
            return res.status(429).json({ success: false, error: "Aguarde a resposta anterior e tente novamente." });
        }
        activeChatUsers.add(userId);
        acquired = true;
        await garantirUsuarioExiste(userId);
        if (conversaId) {
            await dbTransaction(async tx => {
                const owned = await tx.dbGet("SELECT titulo FROM chat_conversas WHERE id = ? AND user_id = ?", [conversaId, userId]);
                if (!owned) throw Object.assign(new Error("Conversa não encontrada."), { status: 404 });
                await enforceQuota(tx, "chat_mensagens", userId, 2);
                await tx.dbRun("INSERT INTO chat_mensagens (conversa_id, user_id, role, conteudo) VALUES (?, ?, 'user', ?)", [conversaId, userId, prompt]);
                if (owned.titulo === "Nova Conversa") {
                    const titulo = prompt.length > 30 ? prompt.slice(0, 30) + "..." : prompt;
                    await tx.dbRun("UPDATE chat_conversas SET titulo = ? WHERE id = ? AND user_id = ?", [titulo, conversaId, userId]);
                }
            });
        }
        const resumo = await dbGet("SELECT (SELECT COALESCE(SUM(valor),0) FROM receitas WHERE user_id = ?) AS receitas, (SELECT COALESCE(SUM(valor),0) FROM gastos WHERE user_id = ?) AS gastos", [userId, userId]);
        const receitas = Number(resumo?.receitas || 0), gastos = Number(resumo?.gastos || 0);
        const systemPrompt = `Você é a LumuzIA, assistente de finanças pessoais. Responda em português brasileiro de forma clara.
Dados financeiros atuais desta conta: receitas R$ ${receitas.toFixed(2)}, gastos R$ ${gastos.toFixed(2)}, saldo R$ ${(receitas - gastos).toFixed(2)}.`;
        const response = await axios.post(bridge.url, {
            action: "generate", model: process.env.OLLAMA_MODEL || "llama3.2:1b", prompt, system: systemPrompt
        }, {
            headers: { "Content-Type": "application/json", "X-Lumuz-Bridge-Secret": bridge.secret },
            httpsAgent, timeout: 60000, maxRedirects: 0, maxContentLength: 256 * 1024, maxBodyLength: 32 * 1024
        });
        const respostaIA = response.data?.resposta;
        if (response.data?.success !== true || typeof respostaIA !== "string" || !respostaIA.trim() || respostaIA.length > 16000) {
            return res.status(502).json({ success: false, error: "Resposta indisponível. Tente novamente." });
        }
        if (conversaId) {
            await dbTransaction(async tx => {
                const owned = await tx.dbGet("SELECT id FROM chat_conversas WHERE id = ? AND user_id = ?", [conversaId, userId]);
                if (!owned) return;
                await enforceQuota(tx, "chat_mensagens", userId);
                await tx.dbRun("INSERT INTO chat_mensagens (conversa_id, user_id, role, conteudo) VALUES (?, ?, 'assistant', ?)", [conversaId, userId, respostaIA]);
            });
        }
        res.json({ success: true, resposta: respostaIA });
    } catch (err) {
        if (err.status && [400, 404, 409].includes(err.status)) return next(err);
        console.error("[IA] Falha de integração:", err.code || "INTERNAL");
        res.status(502).json({ success: false, error: "Falha ao processar a requisição com a IA." });
    } finally { if (acquired) activeChatUsers.delete(userId); }
});
// =====================
// DASHBOARD & ESTATÍSTICAS
// =====================
app.get("/dashboard/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    const userId = req.uid;

    // Parâmetros de período. Modos:
    //   ?mes=2026-09             → mês específico
    //   ?ano=2026                → ano inteiro
    //   ?mesInicio=2026-07&mesFim=2026-09 → período (conjunto de meses)
    // Sem parâmetros → mês atual do servidor
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const { mes, ano, mesInicio, mesFim } = req.query;

    let filtroReceitas = "";
    let filtroGastos  = "";
    let params = [userId];

    if (ano) {
        // Ano inteiro
        filtroReceitas = `AND strftime('%Y', created_at) = ?`;
        filtroGastos   = `AND strftime('%Y', created_at) = ?`;
        params = [userId, String(ano)];
    } else if (mesInicio && mesFim) {
        // Período (conjunto de meses)
        filtroReceitas = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        filtroGastos   = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        params = [userId, mesInicio, mesFim];
    } else {
        // Mês específico ou mês atual
        const mesFiltro = mes || mesAtual;
        filtroReceitas = `AND strftime('%Y-%m', created_at) = ?`;
        filtroGastos   = `AND strftime('%Y-%m', created_at) = ?`;
        params = [userId, mesFiltro];
    }

    try {
        const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);

        const totalReceitasRow = await dbGet(
            `SELECT COALESCE(SUM(valor), 0) AS total FROM receitas WHERE user_id = ? ${filtroReceitas}`,
            params
        );
        const totalGastosRow = await dbGet(
            `SELECT COALESCE(SUM(valor), 0) AS total FROM gastos WHERE user_id = ? ${filtroGastos}`,
            params
        );

        const totalReceitas = totalReceitasRow?.total || 0;
        const totalGastos   = totalGastosRow?.total  || 0;
        const saldo = totalReceitas - totalGastos;

        res.json({
            user: user || { id: userId, nome: "", salario: 0, meta: "", valor_meta: 0 },
            receitas: totalReceitas,
            gastos: totalGastos,
            saldo
        });
    } catch (err) {
        console.error("Erro ao carregar dashboard:", "INTERNAL");
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});
// =====================
// HANDLER GLOBAL DE ERROS (Tratamento seguro sem vazamento de stack trace)
// =====================
app.use((err, req, res, next) => {
    console.error("[SEGURANÇA / ERRO TRATADO]:", err.status || err.code || "INTERNAL");
    if (res.headersSent) return next(err);
    const status = [400, 401, 403, 404, 409, 413, 415, 429, 503].includes(err.status) ? err.status : 500;
    res.status(status).json({
        success: false,
        error: ({ 400: "Requisição inválida.", 409: "Limite de registros atingido.", 413: "Carga excessiva.", 415: "Envie dados em JSON.", 503: "Serviço temporariamente indisponível." })[status] || "Erro interno no servidor."
    });
});

// =====================
// INICIALIZAÇÃO
// =====================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando com sucesso na porta ${PORT}`);
    });
}

// Falhas fatais encerram o processo; o supervisor pode reiniciá-lo sem
// continuar atendendo com estado parcialmente corrompido.
if (require.main === module) {
    process.on("unhandledRejection", () => {
        console.error("[BACKEND] Falha fatal não tratada. Reinício necessário.");
        process.exit(1);
    });
    process.on("uncaughtException", () => {
        console.error("[BACKEND] Falha fatal não tratada. Reinício necessário.");
        process.exit(1);
    });
}

module.exports = app;