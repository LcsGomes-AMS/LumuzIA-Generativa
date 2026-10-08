"use strict";

// Limites comuns aplicados antes de qualquer consulta ou integração externa.
const MAX_VALUE = 1_000_000_000;
const CATEGORIES = new Set(["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Outros", "Geral"]);
const INVESTMENT_TYPES = new Set(["Ação", "FII", "Cripto"]);
const badInput = () => Object.assign(new Error("Entrada inválida."), { status: 400 });

function text(value, max, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "string") throw badInput();
    const result = value.trim();
    if (!result || result.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(result)) throw badInput();
    return result;
}
function optionalText(value, max) {
    return value === undefined || value === "" ? "" : text(value, max);
}
function number(value, { min = 0.01, max = MAX_VALUE, integer = false } = {}) {
    if (!["number", "string"].includes(typeof value)) throw badInput();
    let result;
    if (typeof value === "number") {
        result = value;
    } else {
        const normalized = value.trim().replace(",", ".");
        if (!/^\d+(?:\.\d+)?$/u.test(normalized) || normalized.length > 32) throw badInput();
        result = Number(normalized);
    }
    if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isSafeInteger(result))) throw badInput();
    return result;
}
function id(value) { return number(value, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true }); }
function date(value) {
    if (typeof value !== "string" || !/^(?:19|20|21)\d{2}-\d{2}-\d{2}$/u.test(value)) throw badInput();
    const parsed = new Date(value + "T00:00:00.000Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw badInput();
    return value;
}
function category(value) {
    const result = value === undefined || value === null || value === "" ? "Geral" : text(value, 50);
    if (!CATEGORIES.has(result)) throw badInput();
    return result;
}
function ticker(value) {
    const result = text(value, 24).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,23}$/u.test(result)) throw badInput();
    return result;
}
function investmentType(value) {
    const result = value === undefined ? "Ação" : text(value, 20);
    if (!INVESTMENT_TYPES.has(result)) throw badInput();
    return result;
}
function inspect(value, depth = 0) {
    if (depth > 10) throw badInput();
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw badInput();
        inspect(value[key], depth + 1);
    }
}
function validatePeriod(query) {
    const { mes, ano, mesInicio, mesFim } = query;
    const month = value => typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value);
    if (mes !== undefined && !month(mes)) throw badInput();
    if (ano !== undefined && !/^(?:19|20|21)\d{2}$/u.test(ano)) throw badInput();
    if ((mesInicio === undefined) !== (mesFim === undefined)) throw badInput();
    if (mesInicio !== undefined && (!month(mesInicio) || !month(mesFim) || mesInicio > mesFim)) throw badInput();
    if ([mes !== undefined, ano !== undefined, mesInicio !== undefined].filter(Boolean).length > 1) throw badInput();
}
function validateRequest(req, _res, next) {
    try {
        const pathname = req.path.replace(/\/+$/u, "").toLowerCase();
        const allowedQuery = pathname.startsWith("/dashboard/") || pathname.startsWith("/estatisticas/") ? new Set(["mes", "ano", "mesInicio", "mesFim"]) : pathname.startsWith("/api/cotacao/") ? new Set(["tipo"]) : new Set();
        for (const key of Object.keys(req.query)) if (!allowedQuery.has(key)) throw badInput();
        for (const value of Object.values(req.query)) if (typeof value !== "string" || value.length > 150) throw badInput();
        if (pathname.startsWith("/dashboard/") || pathname.startsWith("/estatisticas/")) validatePeriod(req.query);
        if (["POST", "PUT", "PATCH"].includes(req.method)) {
            if ((["POST", "PUT"].includes(req.method) || req.headers["transfer-encoding"] || Number(req.headers["content-length"] || 0) > 0) && !req.is("application/json")) {
                return next(Object.assign(new Error("Formato inválido."), { status: 415 }));
            }
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw badInput();
            inspect(req.body);
        }
        if (["PUT", "PATCH", "DELETE"].includes(req.method)) {
            const numeric = pathname.match(/^\/(?:receitas|gastos|metas|agendamentos|investimentos)\/([^/]+)(?:\/|$)/u);
            if (numeric && !/^[1-9]\d*$/u.test(numeric[1])) throw badInput();
            if (numeric) id(numeric[1]);
        }
        const conversation = pathname.match(/^\/api\/chat\/conversas\/[^/]+\/([^/]+)(?:\/mensagens)?$/u);
        if (conversation && !/^[1-9]\d*$/u.test(conversation[1])) throw badInput();
        if (conversation) id(conversation[1]);
        const quote = pathname.match(/^\/api\/(?:cotacao\/|investimentos\/historico-ativo\/[^/]+\/)([^/]+)$/u);
        if (quote) ticker(decodeURIComponent(quote[1]));
        if (pathname.startsWith("/api/cotacao/")) investmentType(req.query.tipo);

        const b = req.body;
        if (req.method === "POST" && pathname === "/perfil") {
            req.body = { nome: optionalText(b.nome, 100), salario: number(b.salario ?? 0, { min: 0 }),
                meta: optionalText(b.meta, 150), valorMeta: number(b.valorMeta ?? 0, { min: 0 }) };
        } else if (["POST", "PUT"].includes(req.method) && /^\/(receitas|gastos)(?:\/[^/]+)?$/u.test(pathname)) {
            req.body = { descricao: text(b.descricao, 150), valor: number(b.valor) };
            if (pathname.startsWith("/gastos")) req.body.categoria = category(b.categoria);
        } else if (["POST", "PUT"].includes(req.method) && /^\/metas(?:\/[^/]+)?$/u.test(pathname)) {
            req.body = { nome: text(b.nome, 100), valorObjetivo: number(b.valorObjetivo),
                prazo: number(b.prazo, { min: 1, max: 1200, integer: true }) };
            if (req.method === "PUT") req.body.valorAtual = number(b.valorAtual ?? 0, { min: 0 });
        } else if (req.method === "POST" && pathname === "/agendamentos") {
            if (!["gasto", "receita", "meta"].includes(b.tipo)) throw badInput();
            req.body = { tipo: b.tipo, descricao: text(b.descricao, b.tipo === "meta" ? 100 : 150), valor: number(b.valor),
                categoria: category(b.categoria), dataAgendada: date(b.dataAgendada),
                prazo: b.tipo === "meta" ? number(b.prazo ?? 12, { min: 1, max: 1200, integer: true }) : null };
        } else if (req.method === "POST" && pathname === "/investimentos") {
            req.body = { ticker: ticker(b.ticker), tipo: investmentType(b.tipo),
                quantidade: number(b.quantidade, { min: 0.00000001, max: 1_000_000_000 }),
                precoMedio: number(b.precoMedio, { min: 0.00000001 }),
                dataCompra: date(b.dataCompra || new Date().toISOString().slice(0, 10)) };
            if (req.body.quantidade * req.body.precoMedio > MAX_VALUE) throw badInput();
        } else if (req.method === "POST" && pathname === "/api/chat/conversas") {
            req.body = { titulo: b.titulo === undefined ? "Nova Conversa" : text(b.titulo, 100) };
        } else if (req.method === "POST" && pathname === "/api/ia/chat") {
            req.body = { prompt: text(b.prompt, 1500), conversaId: b.conversaId == null ? null : id(b.conversaId) };
            if (b.modelo !== undefined && b.modelo !== (process.env.OLLAMA_MODEL || "llama3.2:1b")) throw badInput();
        }
        next();
    } catch (err) { next(err.status ? err : badInput()); }
}

const QUOTAS = Object.freeze({ receitas: 10000, gastos: 10000, metas: 1000, agendamentos: 2000,
    investimentos: 500, aportes: 10000, chat_conversas: 200, chat_mensagens: 2000 });
const COUNT_SQL = Object.freeze({
    receitas: "SELECT COUNT(*) AS total FROM receitas WHERE user_id = ?",
    gastos: "SELECT COUNT(*) AS total FROM gastos WHERE user_id = ?",
    metas: "SELECT COUNT(*) AS total FROM metas WHERE user_id = ?",
    agendamentos: "SELECT COUNT(*) AS total FROM agendamentos WHERE user_id = ?",
    investimentos: "SELECT COUNT(*) AS total FROM investimentos WHERE user_id = ?",
    aportes: "SELECT COUNT(*) AS total FROM aportes WHERE user_id = ?",
    chat_conversas: "SELECT COUNT(*) AS total FROM chat_conversas WHERE user_id = ?",
    chat_mensagens: "SELECT COUNT(*) AS total FROM chat_mensagens WHERE user_id = ?"
});
async function enforceQuota(database, table, uid, increment = 1) {
    if (!Object.hasOwn(QUOTAS, table)) throw new Error("Tabela inválida.");
    const row = await database.dbGet(COUNT_SQL[table], [uid]);
    if (Number(row?.total || 0) + increment > QUOTAS[table]) {
        throw Object.assign(new Error("Limite de registros atingido."), { status: 409 });
    }
}

function bridgeConfig() {
    const secret = process.env.OLLAMA_BRIDGE_SECRET || "";
    const input = process.env.OLLAMA_URL || "";
    if (secret.length < 32 || secret.length > 256 || /[\x00-\x20\x7f]/u.test(secret) || !input) return null;
    try {
        const url = new URL(input);
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (url.username || url.password || url.search || url.hash ||
            (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production"))) return null;
        return { url: url.href.replace(/\/$/u, "") + "/index.php", secret };
    } catch { return null; }
}

module.exports = { validateRequest, enforceQuota, bridgeConfig, MAX_VALUE };
