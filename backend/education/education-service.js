"use strict";
const db = require("../database");
const { modules, tasks } = require("./education-content");
const { calendarDate, advanceStreak, visibleStreak } = require("./streak-service");
const { randomUUID } = require("node:crypto");
const fail = (status, message) => { throw Object.assign(new Error(message), { status, education: true }); };
let ready;
function initialize() {
    if (!ready) ready = (async () => {
        if (!(await db.schemaReady)) fail(503, "Banco de dados indisponível.");
        return db.dbTransaction(async tx => {
            if (db.isPostgres) await tx.dbGet("SELECT pg_advisory_xact_lock(1280660813)");
            await tx.dbRun(`CREATE TABLE IF NOT EXISTS education_progress (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                module_id TEXT NOT NULL, task_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('in_progress','completed')),
                attempts INTEGER NOT NULL DEFAULT 0, answered_correct INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT, xp_earned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, task_id))`);
            await tx.dbRun(`CREATE TABLE IF NOT EXISTS education_streak (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                current_streak INTEGER NOT NULL, best_streak INTEGER NOT NULL,
                last_activity_date TEXT NOT NULL, updated_at TEXT NOT NULL)`);
            await tx.dbRun(`CREATE TABLE IF NOT EXISTS education_certificates (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                certificate_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                completed_at TEXT NOT NULL, issued_at TEXT NOT NULL)`);
        });
    })().catch(error => { ready = undefined; throw error; });
    return ready;
}
async function progress(uid, access = db) {
    const rows = await access.dbAll("SELECT * FROM education_progress WHERE user_id = ?", [uid]);
    const streak = await access.dbGet("SELECT * FROM education_streak WHERE user_id = ?", [uid]);
    const completed = new Set(rows.filter(r => r.status === "completed").map(r => r.task_id));
    const completedModules = modules.filter(m => m.tasks.every(id => completed.has(id)));
    const done = completed.size === tasks.length;
    const xp = rows.reduce((sum, r) => sum + r.xp_earned, 0) + completedModules.length * 50 + (done ? 200 : 0);
    const levels = [[0, "Iniciante Financeiro"], [100, "Organizador"], [300, "Planejador"], [700, "Investidor Iniciante"], [1200, "Investidor Consciente"], [2000, "Estrategista Financeiro"], [3500, "Mestre Lumuz"]];
    const level = levels.findLastIndex(([min]) => xp >= min);
    const nextTask = tasks.find(t => !completed.has(t.id));
    return { xp, level: level + 1, levelName: levels[level][1], completedTasks: completed.size, totalTasks: tasks.length,
        percent: Math.round(completed.size / tasks.length * 100), currentStreak: visibleStreak(streak, calendarDate()),
        bestStreak: streak?.best_streak || 0, completedModules: completedModules.map(m => m.id),
        nextTask: nextTask?.id || null, currentModule: modules.find(m => m.id === nextTask?.moduleId)?.title || "Trilha concluída",
        complete: done,
        tasks: tasks.map((task, i) => ({ id: task.id, moduleId: task.moduleId, title: task.title, xp: task.xp,
            status: completed.has(task.id) ? "completed" : i > 0 && !completed.has(tasks[i - 1].id) ? "locked"
                : rows.some(r => r.task_id === task.id) ? "in_progress" : "available" })) };
}
async function recommendations(uid) {
    const goals = await db.dbGet("SELECT COUNT(*) AS total FROM metas WHERE user_id = ?", [uid]);
    const installments = await db.dbGet("SELECT COUNT(*) AS total FROM agendamentos WHERE user_id = ? AND tipo = 'gasto' AND prazo > 1 AND status = 'pendente'", [uid]);
    const result = [];
    if (!Number(goals?.total)) result.push({ moduleId: "metas", text: "Ainda não definiu uma meta? Conheça o módulo Metas Financeiras." });
    if (Number(installments?.total) >= 3) result.push({ moduleId: "dividas", text: "Você tem parcelas pendentes. Revise Dívidas e Juros para apoiar seu planejamento." });
    return result;
}
function taskById(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) fail(404, "Task não encontrada.");
    return task;
}
async function unlocked(uid, id, access = db) {
    const task = taskById(id);
    // Conteúdo novo não impede a revisão das aulas concluídas antes da expansão.
    if (await access.dbGet("SELECT id FROM education_progress WHERE user_id = ? AND task_id = ? AND status = 'completed'", [uid, id])) return task;
    const i = tasks.indexOf(task);
    if (i && !(await access.dbGet("SELECT id FROM education_progress WHERE user_id = ? AND task_id = ? AND status = 'completed'", [uid, tasks[i - 1].id]))) fail(403, "Conclua a task anterior para desbloquear esta etapa.");
    return task;
}
function publicTask(task) {
    const { correctAnswer, explanation, ...safe } = task;
    return safe;
}
async function mutation(uid, callback) {
    await initialize();
    return db.dbTransaction(async tx => {
        await tx.dbRun("INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING", [uid]);
        // O lock do usuário serializa respostas, conclusões e certificados entre processos PostgreSQL.
        if (db.isPostgres) await tx.dbGet("SELECT id FROM users WHERE id = ? FOR UPDATE", [uid]);
        return callback(tx);
    });
}
async function answer(uid, id, value) {
    const task = taskById(id);
    if (!Number.isInteger(value) || value < 0 || value >= task.answers.length) fail(400, "Selecione uma alternativa válida.");
    return mutation(uid, async tx => {
        await unlocked(uid, id, tx);
        const correct = value === task.correctAnswer;
        const now = new Date().toISOString();
        await tx.dbRun(`INSERT INTO education_progress
            (id,user_id,module_id,task_id,status,attempts,answered_correct,created_at,updated_at)
            VALUES (?,?,?,?,'in_progress',1,?,?,?) ON CONFLICT(user_id,task_id) DO UPDATE SET
            attempts = education_progress.attempts + 1, answered_correct = excluded.answered_correct, updated_at = excluded.updated_at`,
        [randomUUID(), uid, task.moduleId, id, correct ? 1 : 0, now, now]);
        return { correct, explanation: task.explanation };
    });
}
async function complete(uid, id) {
    return mutation(uid, async tx => {
        const task = await unlocked(uid, id, tx);
        const row = await tx.dbGet("SELECT * FROM education_progress WHERE user_id = ? AND task_id = ?", [uid, id]);
        if (row?.status === "completed") return { awardedXp: 0, progress: await progress(uid, tx) };
        if (!row?.answered_correct) fail(409, "Responda corretamente antes de concluir.");
        const before = await progress(uid, tx);
        const now = new Date().toISOString(), today = calendarDate(new Date(now));
        await tx.dbRun("UPDATE education_progress SET status = 'completed', xp_earned = ?, completed_at = ?, updated_at = ? WHERE user_id = ? AND task_id = ?", [task.xp, now, now, uid, id]);
        const previous = await tx.dbGet("SELECT * FROM education_streak WHERE user_id = ?", [uid]);
        const streak = advanceStreak(previous, today);
        await tx.dbRun(`INSERT INTO education_streak (id,user_id,current_streak,best_streak,last_activity_date,updated_at)
            VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET current_streak = excluded.current_streak,
            best_streak = excluded.best_streak, last_activity_date = excluded.last_activity_date, updated_at = excluded.updated_at`,
        [randomUUID(), uid, streak.current, streak.best, today, now]);
        const after = await progress(uid, tx);
        return { awardedXp: after.xp - before.xp, moduleCompleted: after.completedModules.length > before.completedModules.length, progress: after };
    });
}
module.exports = { initialize, progress, recommendations, publicTask, unlocked, answer, complete, mutation, fail, modules, tasks };
