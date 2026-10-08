"use strict";
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
require("./test-utils").installTestAuth();
const database = require("./database");
const app = require("./server");

test("agendamentos: isolamento, idempotência concorrente e rollback", async t => {
    const uid = "sec_test_agendamentos", other = "sec_test_agendamentos_other";
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    t.after(async () => {
        await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
        await new Promise(resolve => database.db.close(resolve));
    });
    await database.dbRun("INSERT INTO users (id) VALUES (?)", [uid]);
    async function request(route, method = "GET", user = uid) {
        const response = await fetch(base + route, { method, headers: { "x-test-uid": user }, signal: AbortSignal.timeout(10000) });
        return { status: response.status, data: await response.json() };
    }
    async function create(description, status = "pendente") {
        const result = await database.dbRun("INSERT INTO agendamentos (user_id, tipo, descricao, valor, categoria, data_agendada, status) VALUES (?, 'gasto', ?, 100, 'Geral', '2000-01-01', ?)", [uid, description, status]);
        return result.lastID;
    }
    async function count(description) {
        return (await database.dbGet("SELECT COUNT(*) AS total FROM gastos WHERE user_id = ? AND descricao = ?", [uid, description])).total;
    }
    await t.test("desmarcar, listar e remarcar não duplica parcela vencida", async () => {
        const description = "sec_test_manual";
        const id = await create(description, "lancado");
        await database.dbRun("INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, 100, 'Geral')", [uid, description]);
        assert.equal((await request("/agendamentos/" + id + "/pendente", "PATCH")).status, 200);
        assert.equal((await database.dbGet("SELECT status FROM agendamentos WHERE id = ?", [id])).status, "pendente_manual");
        const list = await request("/agendamentos/" + uid);
        assert.equal(list.data.find(row => row.id === id).status, "pendente");
        assert.deepEqual((await request("/agendamentos/processar/" + uid)).data.lancados, []);
        await request("/agendamentos/" + id + "/pago", "PATCH");
        await request("/agendamentos/" + id + "/pago", "PATCH");
        assert.equal(await count(description), 1);
    });
    await t.test("pendentes comuns são lançadas uma única vez", async () => {
        const description = "sec_test_auto";
        const id = await create(description);
        const result = await request("/agendamentos/" + uid);
        assert.equal(result.data.find(row => row.id === id).status, "lancado");
        await request("/agendamentos/" + uid);
        assert.equal(await count(description), 1);
    });
    await t.test("outra conta não pode consultar nem alterar parcela", async () => {
        const id = await create("sec_test_private");
        assert.equal((await request("/agendamentos/" + uid, "GET", other)).status, 403);
        for (const state of ["pendente", "pago"]) assert.equal((await request("/agendamentos/" + id + "/" + state, "PATCH", other)).status, 404);
        assert.equal((await database.dbGet("SELECT status FROM agendamentos WHERE id = ?", [id])).status, "pendente");
    });
    await t.test("listar, processar e pagar simultaneamente não duplicam lançamentos", async () => {
        const description = "sec_test_concurrent";
        const id = await create(description);
        const replies = await Promise.all(Array.from({ length: 24 }, (_, index) => index % 3 === 0
            ? request("/agendamentos/" + id + "/pago", "PATCH")
            : request(index % 3 === 1 ? "/agendamentos/" + uid : "/agendamentos/processar/" + uid)));
        assert.ok(replies.every(result => result.status === 200));
        assert.equal(await count(description), 1);
        assert.equal((await database.dbGet("SELECT status FROM agendamentos WHERE id = ?", [id])).status, "lancado");
    });
    await t.test("falha no lançamento reverte a mudança de estado e não vaza erro SQL", async () => {
        const description = "sec_test_rollback";
        const id = await create(description);
        await database.dbRun("CREATE TEMP TRIGGER sec_test_fail BEFORE INSERT ON gastos WHEN NEW.descricao = 'sec_test_rollback' BEGIN SELECT RAISE(ABORT, 'sec_test_private_sql_path'); END");
        const failed = await request("/agendamentos/" + id + "/pago", "PATCH");
        assert.equal(failed.status, 500);
        assert.doesNotMatch(JSON.stringify(failed.data), /private_sql|SQLITE|TRIGGER/);
        assert.equal((await database.dbGet("SELECT status FROM agendamentos WHERE id = ?", [id])).status, "pendente");
        assert.equal(await count(description), 0);
        await database.dbRun("DROP TRIGGER sec_test_fail");
        assert.equal((await request("/agendamentos/" + id + "/pago", "PATCH")).status, 200);
        assert.equal(await count(description), 1);
    });
});
