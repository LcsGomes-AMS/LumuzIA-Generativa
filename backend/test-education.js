"use strict";
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
require("./test-utils").installTestAuth();
const db = require("./database");
const service = require("./education/education-service");
const certificates = require("./education/certificate-service");
const { calendarDate, advanceStreak, visibleStreak } = require("./education/streak-service");
const app = require("./server");

test("educação: funcionalidade e ataques em banco isolado", async t => {
    const owner = "sec_test_education_owner", other = "sec_test_education_other";
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api/educacao`;
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => db.db.close(resolve));
    });
    const request = async (path, { uid = owner, body, method = body === undefined ? "GET" : "POST", headers = {} } = {}) => {
        const response = await fetch(base + path, { method, headers: { ...(uid ? { "x-test-uid": uid } : {}), "Content-Type": "application/json", ...headers },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
        return { status: response.status, headers: response.headers, data: response.headers.get("content-type")?.includes("application/pdf") ? Buffer.from(await response.arrayBuffer()) : await response.json() };
    };
    const first = service.tasks[0], second = service.tasks[1];
    await t.test("sem sessão não acessa nenhuma rota; gabarito não vaza", async () => {
        for (const path of ["/trilha", "/progresso", `/task/${first.id}`, "/certificado/pdf"]) assert.equal((await request(path, { uid: null })).status, 401);
        for (const path of [`/task/${first.id}/responder`, `/task/${first.id}/concluir`, "/certificado"]) assert.equal((await request(path, { uid: null, body: {} })).status, 401);
        const result = await request(`/task/${first.id}`);
        assert.equal(result.status, 200);
        assert.equal(result.headers.get("cache-control"), "no-store");
        assert.equal(result.data.correctAnswer, undefined);
        assert.equal(result.data.explanation, undefined);
        const trail = await request("/trilha");
        assert.equal(JSON.stringify(trail.data).includes("correctAnswer"), false);
        assert.equal(trail.data.progress.xp, 0);
        assert.equal(trail.data.progress.tasks[1].status, "locked");
    });
    await t.test("bloqueio no GET, resposta e conclusão; não emite certificado antecipado", async () => {
        assert.equal((await request(`/task/${second.id}`)).status, 403);
        assert.equal((await request(`/task/${second.id}/responder`, { body: { answer: second.correctAnswer } })).status, 403);
        assert.equal((await request(`/task/${second.id}/concluir`, { body: {} })).status, 403);
        assert.equal((await request(`/task/${first.id}/concluir`, { body: {} })).status, 409);
        assert.equal((await request("/certificado", { body: {} })).status, 403);
    });
    await t.test("entrada estrita impede mass assignment, SQLi e prototype pollution", async () => {
        for (const value of [null, true, "1", -1, 99, 0.5, {}, [], "0 OR 1=1"]) {
            assert.equal((await request(`/task/${first.id}/responder`, { body: { answer: value } })).status, 400);
        }
        for (const key of ["uid", "user_id", "xp", "status", "completed_at", "currentStreak", "certificate_code"]) {
            assert.equal((await request(`/task/${first.id}/responder`, { body: { answer: first.correctAnswer, [key]: other } })).status, 400);
            assert.equal((await request(`/task/${first.id}/concluir`, { body: { [key]: 99999 } })).status, 400);
        }
        assert.equal((await request(`/task/${encodeURIComponent("' OR 1=1--")}`)).status, 404);
        assert.equal((await request("/trilha?uid=" + other)).status, 400);
        const pollution = JSON.parse('{"answer":1,"__proto__":{"admin":true}}');
        assert.equal((await request(`/task/${first.id}/responder`, { body: pollution })).status, 400);
        assert.equal({}.admin, undefined);
        assert.equal((await request(`/task/${first.id}/responder`, { body: { answer: 1 }, headers: { "Content-Type": "text/plain" } })).status, 415);
    });
    await t.test("erro permite nova tentativa e conclusão requer acerto", async () => {
        const wrong = await request(`/task/${first.id}/responder`, { body: { answer: (first.correctAnswer + 1) % first.answers.length } });
        assert.equal(wrong.data.correct, false); assert.ok(wrong.data.explanation);
        assert.equal((await request(`/task/${first.id}/concluir`, { body: {} })).status, 409);
        const right = await request(`/task/${first.id}/responder`, { body: { answer: first.correctAnswer } });
        assert.equal(right.data.correct, true);
    });
    await t.test("conclusões concorrentes e replay concedem XP uma única vez", async () => {
        const results = await Promise.all(Array.from({ length: 6 }, () => request(`/task/${first.id}/concluir`, { body: {} })));
        assert.ok(results.every(r => r.status === 200));
        assert.equal(results.reduce((sum, r) => sum + r.data.awardedXp, 0), first.xp);
        const p = (await request("/progresso")).data;
        assert.equal(p.xp, first.xp); assert.equal(p.currentStreak, 1); assert.equal(p.completedTasks, 1);
        assert.equal(p.tasks[1].status, "available");
        await request(`/task/${first.id}/responder`, { body: { answer: first.correctAnswer } });
        assert.equal((await request(`/task/${first.id}/concluir`, { body: {} })).data.awardedXp, 0);
    });
    await t.test("progresso e certificados são isolados entre contas", async () => {
        const p = (await request("/progresso", { uid: other })).data;
        assert.equal(p.xp, 0); assert.equal(p.completedTasks, 0); assert.equal(p.currentStreak, 0);
        assert.equal((await request(`/task/${second.id}`, { uid: other })).status, 403);
        await db.dbRun("INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING", [other]);
        await db.dbRun("INSERT INTO metas (user_id,nome,valor_objetivo,valor_atual,prazo) VALUES (?,?,100,0,12)", [other, "Objetivo teste"]);
        assert.equal((await request("/trilha")).data.recommendations.some(r => r.moduleId === "metas"), true);
        assert.equal((await request("/trilha", { uid: other })).data.recommendations.some(r => r.moduleId === "metas"), false);
    });
    await t.test("trilha completa soma XP e bônus e permite certificado idempotente com nome do perfil", async () => {
        for (const task of service.tasks.slice(1)) {
            await service.answer(owner, task.id, task.correctAnswer);
            await service.complete(owner, task.id);
        }
        const p = await service.progress(owner);
        assert.equal(p.complete, true);
        assert.equal(p.xp, service.tasks.reduce((s, task) => s + task.xp, 0) + service.modules.length * 50 + 200);
        assert.equal(p.currentStreak, 1);
        await db.dbRun("UPDATE users SET nome = ? WHERE id = ?", ["Maria D'Ávila", owner]);
        const issued = await Promise.all([certificates.issue(owner), certificates.issue(owner)]);
        assert.equal(issued[0].certificate_code, issued[1].certificate_code);
        assert.equal(issued[0].name, "Maria D'Ávila");
        assert.match(issued[0].certificate_code, /^LUMUZ-EF-[A-F0-9]{24}$/);
        const verified = await request(`/certificado/${issued[0].certificate_code}`);
        assert.equal(verified.data.valid, true);
        assert.equal(verified.data.user_id, undefined);
        assert.equal((await request(`/certificado/${issued[0].certificate_code}`, { uid: other })).status, 404);
        assert.equal((await request("/certificado/pdf", { uid: other })).status, 404);
        const pdf = await request("/certificado/pdf");
        assert.equal(pdf.status, 200); assert.equal(pdf.data.subarray(0, 5).toString(), "%PDF-");
        assert.ok(pdf.data.includes(Buffer.from("%%EOF"))); assert.ok(pdf.data.length > 3000);
    });
    await t.test("nome ausente exige perfil; fallback Firebase e códigos distintos", async () => {
        await service.mutation(other, async tx => {
            await tx.dbRun(`INSERT INTO education_progress (id,user_id,module_id,task_id,status,attempts,answered_correct,completed_at,xp_earned,created_at,updated_at)
                SELECT id || '-other', ?, module_id,task_id,status,attempts,answered_correct,completed_at,xp_earned,created_at,updated_at FROM education_progress WHERE user_id = ?`, [other, owner]);
        });
        await assert.rejects(certificates.issue(other, async () => ""), error => error.status === 409);
        const issued = await certificates.issue(other, async () => "João Silva");
        assert.equal(issued.name, "João Silva");
        const original = await certificates.issue(owner);
        assert.notEqual(issued.certificate_code, original.certificate_code);
    });
    await t.test("rate limit de escrita é aplicado também à educação", async () => {
        let status;
        for (let i = 0; i < 205; i++) {
            status = (await request(`/task/${first.id}/responder`, { uid: "sec_test_education_rate", body: { answer: 0 } })).status;
            if (status === 429) break;
        }
        assert.equal(status, 429);
    });
});

test("ofensiva usa calendário de São Paulo, continuidade, quebra e virada de ano", () => {
    assert.equal(calendarDate(new Date("2026-10-27T02:59:59Z")), "2026-10-26");
    assert.equal(calendarDate(new Date("2026-10-27T03:00:00Z")), "2026-10-27");
    assert.deepEqual(advanceStreak(null, "2026-10-26"), { current: 1, best: 1 });
    const row = { current_streak: 4, best_streak: 9, last_activity_date: "2026-10-26" };
    assert.deepEqual(advanceStreak(row, "2026-10-26"), { current: 4, best: 9 });
    assert.deepEqual(advanceStreak(row, "2026-10-27"), { current: 5, best: 9 });
    assert.deepEqual(advanceStreak(row, "2026-10-29"), { current: 1, best: 9 });
    assert.equal(visibleStreak(row, "2026-10-28"), 0);
    assert.equal(visibleStreak(row, "2026-10-27"), 4);
    assert.equal(advanceStreak({ ...row, last_activity_date: "2025-12-31" }, "2026-01-01").current, 5);
    assert.equal(advanceStreak({ ...row, last_activity_date: "2024-02-29" }, "2024-03-01").current, 5);
});
