"use strict";
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { installTestAuth } = require("./test-utils");
installTestAuth();
const database = require("./database");
const axios = require("axios");
const app = require("./server");

test("segurança das rotas com banco isolado em memória e serviços simulados", async t => {
    const owner = "sec_test_routes_owner", other = "sec_test_routes_other";
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    const calls = [];
    axios.defaults.adapter = async config => {
        calls.push(config);
        return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, resposta: "sec_test_resposta" } };
    };
    process.env.OLLAMA_URL = "https://sec-test.invalid/bridge";
    process.env.OLLAMA_BRIDGE_SECRET = "sec_test_" + "x".repeat(32);
    t.after(async () => {
        await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
        await new Promise(resolve => database.db.close(resolve));
    });
    async function request(route, { method = "GET", body, uid = owner, headers = {} } = {}) {
        const options = { method, headers: { ...(uid ? { "x-test-uid": uid } : {}), ...headers }, signal: AbortSignal.timeout(10000) };
        if (body !== undefined) {
            options.body = typeof body === "string" ? body : JSON.stringify(body);
            if (!options.headers["Content-Type"]) options.headers["Content-Type"] = "application/json";
        }
        const response = await fetch(base + route, options);
        return { status: response.status, data: await response.json(), headers: response.headers };
    }
    for (const uid of [owner, other]) await database.dbRun("INSERT INTO users (id) VALUES (?)", [uid]);

    await t.test("rotas privadas recusam anônimos e não armazenam respostas em cache", async () => {
        for (const route of ["/api/db-status", "/receitas/" + owner, "/api/chat/conversas/" + owner]) {
            assert.equal((await request(route, { uid: null })).status, 401);
        }
        const result = await request("/api/db-status");
        assert.equal(result.status, 200);
        assert.equal(result.headers.get("cache-control"), "no-store");
        assert.equal(result.headers.get("x-powered-by"), null);
    });

    await t.test("conversa de outra conta não aceita mensagens nem mudança de título", async () => {
        const foreign = await database.dbRun("INSERT INTO chat_conversas (user_id, titulo) VALUES (?, ?)", [other, "Nova Conversa"]);
        const before = calls.length;
        const response = await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_attack", conversaId: foreign.lastID } });
        assert.equal(response.status, 404);
        assert.equal(calls.length, before);
        assert.equal((await database.dbGet("SELECT titulo FROM chat_conversas WHERE id = ?", [foreign.lastID])).titulo, "Nova Conversa");
        assert.equal((await database.dbGet("SELECT COUNT(*) AS total FROM chat_mensagens WHERE conversa_id = ?", [foreign.lastID])).total, 0);
    });

    await t.test("chat legítimo usa bridge restrita e mantém ambas mensagens no dono", async () => {
        const created = await request("/api/chat/conversas", { method: "POST", body: { user_id: other } });
        assert.equal(created.status, 200);
        assert.equal(created.data.conversa.user_id, owner);
        const result = await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_prompt", conversaId: created.data.conversa.id } });
        assert.equal(result.status, 200);
        assert.equal(result.data.resposta, "sec_test_resposta");
        const call = calls.at(-1);
        assert.equal(call.url, "https://sec-test.invalid/bridge/index.php");
        assert.equal(call.maxRedirects, 0);
        assert.equal(call.headers.get("X-Lumuz-Bridge-Secret"), process.env.OLLAMA_BRIDGE_SECRET);
        const messages = await database.dbAll("SELECT * FROM chat_mensagens WHERE conversa_id = ?", [created.data.conversa.id]);
        assert.deepEqual(messages.map(row => row.user_id), [owner, owner]);
        assert.deepEqual(messages.map(row => row.role), ["user", "assistant"]);
    });

    await t.test("erros do provedor não vazam detalhes e configuração ausente falha fechada", async () => {
        const original = axios.defaults.adapter;
        axios.defaults.adapter = async config => ({ status: 200, statusText: "OK", headers: {}, config, data: { success: false, error: "sec_test_private_path_password" } });
        const result = await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_failure" } });
        assert.equal(result.status, 502);
        assert.doesNotMatch(JSON.stringify(result.data), /private_path|password/);
        delete process.env.OLLAMA_BRIDGE_SECRET;
        assert.equal((await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_disabled" } })).status, 503);
        process.env.OLLAMA_BRIDGE_SECRET = "sec_test_" + "x".repeat(32);
        axios.defaults.adapter = original;
    });

    await t.test("chat recusa modelo arbitrário, prompt excessivo e execução paralela da mesma conta", async () => {
        assert.equal((await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test", modelo: "sec_test_huge_model" } })).status, 400);
        assert.equal((await request("/api/ia/chat", { method: "POST", body: { prompt: "x".repeat(1501) } })).status, 400);
        const original = axios.defaults.adapter;
        let release, started;
        const waiting = new Promise(resolve => { release = resolve; });
        const entered = new Promise(resolve => { started = resolve; });
        axios.defaults.adapter = async config => {
            started();
            await waiting;
            return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, resposta: "sec_test_finished" } };
        };
        const first = request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_first" } });
        await entered;
        const second = await request("/api/ia/chat", { method: "POST", body: { prompt: "sec_test_second" } });
        assert.equal(second.status, 429);
        assert.equal(second.headers.get("retry-after"), "5");
        release();
        assert.equal((await first).status, 200);
        axios.defaults.adapter = original;
    });

    await t.test("contadores do diagnóstico abrangem somente a conta autenticada", async () => {
        await database.dbRun("INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)", [other, "sec_test_private_income", 100]);
        const result = await request("/api/db-status");
        assert.equal(result.data.contadores.receitas, 0);
        assert.equal(result.data.contadores.usuarios, undefined);
        assert.equal(result.data.engine, undefined);
    });

    await t.test("CORS bloqueia origem arbitrária que não contém palavras predefinidas", async () => {
        for (const origin of ["https://innocent-looking.example", "null"]) {
            const result = await request("/api/db-status", { headers: { Origin: origin } });
            assert.equal(result.headers.get("access-control-allow-origin"), null);
        }
        const allowed = await request("/api/db-status", { headers: { Origin: base } });
        assert.equal(allowed.headers.get("access-control-allow-origin"), base);
    });

    await t.test("todas as escritas validam tipos, faixas, enums e datas", async () => {
        const cases = [
            ["/perfil", { nome: {}, salario: 100 }],
            ["/perfil", { salario: -1 }],
            ["/receitas", { descricao: "sec_test", valor: 1e200 }],
            ["/receitas", { descricao: "x".repeat(151), valor: 1 }],
            ["/RECEITAS/", { descricao: "sec_test_bypass", valor: -1 }],
            ["/GASTOS/", { descricao: "sec_test_bypass", valor: -1 }],
            ["/AGENDAMENTOS/", { tipo: "gasto", descricao: "sec_test_bypass", valor: -1, dataAgendada: "2026-10-01" }],
            ["/INVESTIMENTOS/", { ticker: "SEC4", quantidade: -1, precoMedio: 1 }],
            ["/gastos", { descricao: "sec_test", valor: 1, categoria: "sec_test_unknown" }],
            ["/metas", { nome: "sec_test", valorObjetivo: 1, prazo: "12junk" }],
            ["/metas", { nome: "sec_test", valorObjetivo: 1, prazo: 1201 }],
            ["/agendamentos", { tipo: "gasto", descricao: "sec_test", valor: -1, dataAgendada: "2026-10-01" }],
            ["/agendamentos", { tipo: "gasto", descricao: "sec_test", valor: 10, dataAgendada: "2026-02-30" }],
            ["/agendamentos", { tipo: "sec_test_invalid", descricao: "sec_test", valor: 10, dataAgendada: "2026-10-01" }],
            ["/investimentos", { ticker: {}, quantidade: 1, precoMedio: 1 }],
            ["/investimentos", { ticker: "SEC4", quantidade: "1junk", precoMedio: 1 }],
            ["/investimentos", { ticker: "SEC4", quantidade: 1, precoMedio: -1 }],
            ["/investimentos", { ticker: "SEC4", quantidade: 1e9, precoMedio: 1e9 }],
            ["/investimentos", { ticker: "../secret", quantidade: 1, precoMedio: 1 }],
            ["/api/chat/conversas", { titulo: "x".repeat(101) }]
        ];
        for (const [route, body] of cases) {
            assert.equal((await request(route, { method: "POST", body })).status, 400, route + " " + JSON.stringify(body));
        }
        for (const [route, body] of [
            ["/gastos/1", { descricao: "sec_test", valor: {}, categoria: "Outros" }],
            ["/metas/1", { nome: "sec_test", valorObjetivo: 1, prazo: 1, valorAtual: -1 }]
        ]) assert.equal((await request(route, { method: "PUT", body })).status, 400);
        for (const route of ["/receitas/1junk", "/gastos/0", "/metas/9007199254740992"]) {
            assert.equal((await request(route, { method: "DELETE" })).status, 400);
        }
        for (const route of ["/dashboard/" + owner + "?mes=2026-13", "/dashboard/" + owner + "?mes=2026-01&mes=2026-02",
            "/estatisticas/" + owner + "?mesInicio=2026-05&mesFim=2026-01", "/api/cotacao/SEC4?tipo[]=Ação"]) {
            assert.equal((await request(route)).status, 400, route);
        }
        assert.equal((await request("/receitas", { method: "POST", body: '{"descricao":"sec_test","valor":10,"__proto__":{}}' })).status, 400);
        assert.equal((await request("/receitas", { method: "POST", body: '{"descricao":"sec_test","valor":10}', headers: { "Content-Type": "text/plain" } })).status, 415);
    });

    await t.test("aportes concorrentes não perdem quantidade e não criam posições duplicadas", async () => {
        const replies = await Promise.all(Array.from({ length: 12 }, () => request("/investimentos", {
            method: "POST", body: { ticker: "SEC4", tipo: "Ação", quantidade: 2, precoMedio: 10, user_id: other }
        })));
        assert.ok(replies.every(result => result.status === 200));
        const positions = await database.dbAll("SELECT * FROM investimentos WHERE user_id = ? AND ticker = ?", [owner, "SEC4"]);
        assert.equal(positions.length, 1);
        assert.equal(positions[0].quantidade, 24);
        assert.equal(positions[0].preco_medio, 10);
        assert.equal((await database.dbGet("SELECT COUNT(*) AS total FROM aportes WHERE user_id = ?", [owner])).total, 12);
        assert.equal((await database.dbGet("SELECT COUNT(*) AS total FROM investimentos WHERE user_id = ?", [other])).total, 0);
    });


    await t.test("números fracionários pequenos são válidos e corpos chunked fora de JSON são recusados", async () => {
        const fractional = await request("/investimentos", { method: "POST", body: { ticker: "SECFRACTION", tipo: "Cripto", quantidade: 1e-8, precoMedio: 1e-8 } });
        assert.equal(fractional.status, 200);
        const position = await database.dbGet("SELECT quantidade FROM investimentos WHERE user_id = ? AND ticker = ?", [owner, "SECFRACTION"]);
        assert.equal(position.quantidade, 1e-8);
        const http = require("node:http");
        for (const route of ["/perfil", "/api/chat/conversas"]) {
            const status = await new Promise((resolve, reject) => {
                const req = http.request(base + route, { method: "POST", headers: { "x-test-uid": owner, "Content-Type": "text/plain", "Transfer-Encoding": "chunked" } },
                    response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
                req.on("error", reject);
                req.write('{"titulo":"sec_test_wrong_format"}');
                req.end();
            });
            assert.equal(status, 415, route);
        }
    });
    await t.test("cotações inválidas usam cache curto para evitar chamadas externas repetidas", async () => {
        const original = axios.defaults.adapter;
        let upstreamCalls = 0;
        axios.defaults.adapter = async () => { upstreamCalls++; throw new Error("sec_test_provider_offline"); };
        for (let i = 0; i < 3; i++) assert.equal((await request("/api/cotacao/SECFAIL")).status, 404);
        assert.equal(upstreamCalls, 1);
        axios.defaults.adapter = original;
    });

    await t.test("quota de conversas é aplicada antes da gravação", async () => {
        const total = (await database.dbGet("SELECT COUNT(*) AS total FROM chat_conversas WHERE user_id = ?", [owner])).total;
        await database.dbTransaction(async tx => {
            for (let i = total; i < 200; i++) await tx.dbRun("INSERT INTO chat_conversas (user_id, titulo) VALUES (?, ?)", [owner, "sec_test_quota_" + i]);
        });
        const result = await request("/api/chat/conversas", { method: "POST", body: { titulo: "sec_test_over_limit" } });
        assert.equal(result.status, 409);
        assert.equal((await database.dbGet("SELECT COUNT(*) AS total FROM chat_conversas WHERE user_id = ?", [owner])).total, 200);
    });
});
