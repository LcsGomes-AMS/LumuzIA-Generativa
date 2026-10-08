"use strict";
process.env.NODE_ENV = "test";
// Se isto fosse usado, o teste tentaria um servidor inexistente. Deve ser ignorado.
process.env.DATABASE_URL = "postgresql://sec_test:sec_test@invalid.example/sec_test?sslmode=disable";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const postgresConfig = require("./postgres-config");
const database = require("./database");

test.after(() => new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve())));

test("testes ignoram DATABASE_URL e usam exclusivamente memória", async () => {
    assert.equal(database.isPostgres, false);
    const files = await database.dbAll("PRAGMA database_list");
    assert.equal(files.find(row => row.name === "main").file, "");
});

test("URL PostgreSQL não pode desativar TLS nem substituir verificação do certificado", () => {
    for (const params of ["sslmode=disable", "sslmode=no-verify", "ssl=0", "sslmode=require&uselibpqcompat=true", "sslcert=private.pem&sslkey=private.key&sslrootcert=arbitrary.pem", "SSLMODE=disable"]) {
        const config = postgresConfig(`postgresql://sec_test:sec_test@db.invalid/sec_test?application_name=sec_test&${params}`);
        assert.equal(config.ssl.rejectUnauthorized, true);
        const parsed = require("pg-connection-string").parse(config.connectionString);
        assert.equal(parsed.ssl, undefined);
        assert.equal(new URL(config.connectionString).searchParams.get("application_name"), "sec_test");
    }
    assert.throws(() => postgresConfig("https://db.invalid"));
    assert.throws(() => postgresConfig("senha-secreta-invalida"), error => !error.message.includes("senha-secreta-invalida"));
});

test("rollback SQLite desfaz todas as gravações", async () => {
    const uid = "sec_test_rollback";
    await assert.rejects(database.dbTransaction(async tx => {
        await tx.dbRun("INSERT INTO users (id) VALUES (?)", [uid]);
        await tx.dbRun("INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)", [uid, "Teste", 10]);
        throw new Error("rollback sintético");
    }), /rollback sintético/);
    assert.equal(await database.dbGet("SELECT id FROM users WHERE id = ?", [uid]), undefined);
    assert.equal((await database.dbGet("SELECT COUNT(*) AS total FROM receitas WHERE user_id = ?", [uid])).total, 0);
});

test("operações externas aguardam fim da transação e não entram no rollback", async () => {
    let entered, release;
    const started = new Promise(resolve => { entered = resolve; });
    const barrier = new Promise(resolve => { release = resolve; });
    const transaction = database.dbTransaction(async tx => {
        await tx.dbRun("INSERT INTO users (id) VALUES (?)", ["sec_test_transaction"]);
        entered();
        await barrier;
        throw new Error("rollback isolado");
    });
    const expectedFailure = assert.rejects(transaction, /rollback isolado/);
    await started;
    let completed = false;
    const outside = database.dbRun("INSERT INTO users (id) VALUES (?)", ["sec_test_outside"]).then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false);
    release();
    await Promise.all([expectedFailure, outside]);
    assert.ok(await database.dbGet("SELECT id FROM users WHERE id = ?", ["sec_test_outside"]));
    assert.equal(await database.dbGet("SELECT id FROM users WHERE id = ?", ["sec_test_transaction"]), undefined);
});

test("transações SQLite concorrentes são serializadas sem perda de atualização", async () => {
    const uid = "sec_test_counter";
    await database.dbRun("INSERT INTO users (id, salario) VALUES (?, ?)", [uid, 0]);
    await Promise.all(Array.from({ length: 20 }, () => database.dbTransaction(async tx => {
        const row = await tx.dbGet("SELECT salario FROM users WHERE id = ?", [uid]);
        await new Promise(resolve => setImmediate(resolve));
        await tx.dbRun("UPDATE users SET salario = ? WHERE id = ?", [row.salario + 1, uid]);
    })));
    assert.equal((await database.dbGet("SELECT salario FROM users WHERE id = ?", [uid])).salario, 20);
});

function postgresHarness() {
    const queries = [];
    let released = 0, options;
    const client = { async query(sql, values) {
        queries.push({ location: "client", sql, values });
        if (sql === "FAIL") throw new Error("erro sintético");
        return { rows: [{ id: 42 }], rowCount: 1 };
    }, release() { released++; } };
    class Pool {
        constructor(config) { options = config; }
        on() {}
        async query(sql, values) { queries.push({ location: "pool", sql, values }); return { rows: [{ id: 41 }], rowCount: 1 }; }
        async connect() { return client; }
    }
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "database.js"), "utf8"), {
        module, __dirname, console: { log() {}, error() {} },
        process: { env: { NODE_ENV: "production", DATABASE_URL: "postgresql://sec_test:sec_test@invalid.example/sec_test?sslmode=disable" } },
        require(name) {
            if (name === "pg") return { Pool, types: { setTypeParser() {} } };
            if (name === "dotenv") return { config() {} };
            if (name === "./postgres-config") return postgresConfig;
            if (["path", "node:async_hooks"].includes(name)) return require(name);
            throw new Error(`Import inesperado: ${name}`);
        }
    });
    return { db: module.exports, queries, get released() { return released; }, get options() { return options; } };
}

test("PostgreSQL transaciona na mesma conexão e devolve o ID inserido", async () => {
    const h = postgresHarness();
    const id = await h.db.dbTransaction(async tx => {
        const result = await tx.dbRun("INSERT INTO users (id) VALUES (?)", ["sec_test_pg"]);
        // Reuso do contexto também impede consulta global escapar da conexão.
        await h.db.dbGet("SELECT id FROM users WHERE id = ?", ["sec_test_pg"]);
        return result.lastID;
    });
    assert.equal(id, 42);
    const txQueries = h.queries.filter(q => q.location === "client");
    assert.equal(txQueries[0].sql, "BEGIN");
    assert.match(txQueries[1].sql, /VALUES \(\$1\) RETURNING id/);
    assert.equal(txQueries.at(-1).sql, "COMMIT");
    assert.equal(h.released, 1);
    assert.equal(h.options.ssl.rejectUnauthorized, true);
});

test("falha PostgreSQL executa rollback e libera conexão", async () => {
    const h = postgresHarness();
    await assert.rejects(h.db.dbTransaction(tx => tx.dbRun("FAIL")), /erro sintético/);
    assert.equal(h.queries.at(-1).sql, "ROLLBACK");
    assert.equal(h.released, 1);
});
