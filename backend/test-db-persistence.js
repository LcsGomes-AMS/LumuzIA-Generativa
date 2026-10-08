"use strict";
// Mantém o comando test:db, mas nunca escreve no banco do usuário.
process.env.NODE_ENV = "test";
const assert = require("node:assert/strict");
const { db, dbRun, dbGet, dbTransaction, isPostgres } = require("./database");

(async () => {
    assert.equal(isPostgres, false);
    const uid = `sec_test_persistence_${Date.now()}`;
    try {
        await dbRun("INSERT INTO users (id, nome, salario) VALUES (?, ?, ?)", [uid, "Teste isolado", 5000]);
        assert.equal((await dbGet("SELECT salario FROM users WHERE id = ?", [uid])).salario, 5000);
        await dbTransaction(async tx => {
            await tx.dbRun("UPDATE users SET salario = ? WHERE id = ?", [6000, uid]);
            assert.equal((await tx.dbGet("SELECT salario FROM users WHERE id = ?", [uid])).salario, 6000);
        });
        await assert.rejects(dbTransaction(async tx => {
            await tx.dbRun("UPDATE users SET salario = ? WHERE id = ?", [7000, uid]);
            throw new Error("Rollback proposital de teste");
        }));
        assert.equal((await dbGet("SELECT salario FROM users WHERE id = ?", [uid])).salario, 6000);
        await dbRun("DELETE FROM users WHERE id = ?", [uid]);
        assert.equal(await dbGet("SELECT id FROM users WHERE id = ?", [uid]), undefined);
        console.log("PASS: leitura, gravação, commit, rollback e limpeza em SQLite temporário.");
        console.log("Este teste não verifica backups ou persistência da hospedagem.");
    } finally {
        await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    }
})().catch(() => {
    console.error("FAIL: teste isolado do banco.");
    process.exitCode = 1;
});
