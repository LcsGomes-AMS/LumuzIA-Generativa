const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

test("reversão de parcelas preserva o lançamento e o isolamento", async t => {
    const uid = "sec_test_user";
    const parcela = { id: 1, user_id: uid, tipo: "gasto", descricao: "Compra (1/2)",
        valor: 100, categoria: "Geral", data_agendada: "2000-01-01", status: "lancado" };
    let gastos = 1;
    const reset = () => { parcela.status = "lancado"; gastos = 1; };
    const owned = params => Number(params[0]) === parcela.id && (params.length === 1 || params[1] === uid);
    const database = {
        db: null, isPostgres: false,
        async dbGet(sql, params) {
            assert.match(sql, /SELECT \* FROM agendamentos WHERE id = \? AND user_id = \?/i);
            return owned(params) ? { ...parcela } : undefined;
        },
        async dbAll(sql, params) {
            assert.match(sql, /SELECT \* FROM agendamentos WHERE user_id = \?/i);
            if (params[0] !== uid) return [];
            if (/status\s*=\s*'pendente'/i.test(sql)) {
                return parcela.status === "pendente" && parcela.data_agendada <= params[1] ? [{ ...parcela }] : [];
            }
            return [{ ...parcela }];
        },
        async dbRun(sql, params) {
            if (/INSERT INTO gastos/i.test(sql)) {
                assert.equal(params[0], uid);
                return { changes: 1, lastID: ++gastos };
            }
            assert.match(sql, /UPDATE agendamentos SET status/i);
            if (!owned(params)) return { changes: 0 };
            if (/CASE\s+WHEN/i.test(sql)) {
                if (parcela.status === "lancado") parcela.status = "pendente_manual";
            } else parcela.status = sql.match(/SET\s+status\s*=\s*'([^']+)'/i)[1];
            return { changes: 1 };
        }
    };
    const entries = [["./database", database], ["./firebaseAdmin", {
        verificarAutenticacao(req, _res, next) { req.uid = req.get("x-test-uid") || uid; next(); }
    }]];
    const saved = entries.map(([name]) => [require.resolve(name), require.cache[require.resolve(name)]]);
    const serverPath = require.resolve("./server");
    saved.push([serverPath, require.cache[serverPath]]);
    let app;
    try {
        entries.forEach(([name, exports]) => {
            const id = require.resolve(name);
            require.cache[id] = { id, filename: id, loaded: true, exports };
        });
        delete require.cache[serverPath];
        app = require("./server");
    } finally {
        for (const [id, cached] of saved) {
            if (cached) require.cache[id] = cached; else delete require.cache[id];
        }
    }
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    async function request(route, method = "GET", user = uid) {
        const response = await fetch(base + route, { method, headers: { "x-test-uid": user }, signal: AbortSignal.timeout(5000) });
        return { status: response.status, data: await response.json() };
    }
    await t.test("desmarcar, listar e remarcar não duplica parcela vencida", async () => {
        reset();
        assert.equal((await request("/agendamentos/1/pendente", "PATCH")).status, 200);
        assert.equal(parcela.status, "pendente_manual");
        const list = await request("/agendamentos/" + uid);
        assert.equal(list.data[0].status, "pendente");
        assert.equal(parcela.status, "pendente_manual");
        assert.equal(gastos, 1);
        assert.deepEqual((await request("/agendamentos/processar/" + uid)).data.lancados, []);
        await request("/agendamentos/1/pendente", "PATCH");
        assert.equal(parcela.status, "pendente_manual");
        await request("/agendamentos/1/pago", "PATCH");
        assert.equal(parcela.status, "lancado");
        await request("/agendamentos/1/pago", "PATCH");
        assert.equal(gastos, 1);
    });
    await t.test("pendentes comuns continuam sendo lançadas automaticamente", async () => {
        reset(); parcela.status = "pendente";
        const list = await request("/agendamentos/" + uid);
        assert.equal(list.data[0].status, "lancado");
        assert.equal(gastos, 2);
        await request("/agendamentos/" + uid);
        assert.equal(gastos, 2);
    });
    await t.test("outra conta não pode consultar nem alterar parcela", async () => {
        reset();
        assert.equal((await request("/agendamentos/" + uid, "GET", "sec_test_other")).status, 403);
        for (const status of ["pendente", "pago"]) {
            assert.equal((await request("/agendamentos/1/" + status, "PATCH", "sec_test_other")).status, 404);
        }
        assert.equal(parcela.status, "lancado");
        assert.equal(gastos, 1);
    });
});
