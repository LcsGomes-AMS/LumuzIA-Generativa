/**
 * Script de Migração: SQLite local (lumuzia.db) -> Neon PostgreSQL
 * 
 * Uso:
 *   node backend/migrateToNeon.js
 * ou definindo inline:
 *   DATABASE_URL="postgresql://usuario:senha@ep-...neon.tech/neondb?sslmode=require" node backend/migrateToNeon.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config();

const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("❌ ERRO: DATABASE_URL não foi encontrada!");
    console.error("Defina a variável DATABASE_URL no seu arquivo .env ou passe como variável de ambiente:");
    console.error("Exemplo: DATABASE_URL=\"postgresql://...\" node backend/migrateToNeon.js");
    process.exit(1);
}

const sqlitePath = path.join(__dirname, "lumuzia.db");
const sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
    if (err) {
        console.error("❌ Erro ao abrir SQLite:", err.message);
        process.exit(1);
    }
});

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

const getSqliteData = (table) => new Promise((resolve) => {
    sqliteDb.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) {
            console.warn(`[AVISO] Tabela ${table} não encontrada no SQLite ou vazia.`);
            resolve([]);
        } else {
            resolve(rows || []);
        }
    });
});

async function migrar() {
    console.log("🚀 Iniciando migração de SQLite para Neon PostgreSQL...");

    try {
        await pool.query("SELECT 1");
        console.log("✅ Conexão com o Neon estabelecida com sucesso!");

        // 1. Users
        const users = await getSqliteData("users");
        for (const u of users) {
            await pool.query(
                `INSERT INTO users (id, nome, salario, meta, valor_meta, perfil)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                    nome = EXCLUDED.nome,
                    salario = EXCLUDED.salario,
                    meta = EXCLUDED.meta,
                    valor_meta = EXCLUDED.valor_meta,
                    perfil = EXCLUDED.perfil`,
                [u.id, u.nome, u.salario, u.meta, u.valor_meta, u.perfil]
            );
        }
        console.log(`👤 Usuários migrados: ${users.length}`);

        // 2. Gastos
        const gastos = await getSqliteData("gastos");
        for (const g of gastos) {
            await pool.query(
                `INSERT INTO gastos (id, user_id, descricao, valor, categoria, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [g.id, g.user_id, g.descricao, g.valor, g.categoria, g.created_at]
            );
        }
        console.log(`💸 Gastos migrados: ${gastos.length}`);

        // 3. Receitas
        const receitas = await getSqliteData("receitas");
        for (const r of receitas) {
            await pool.query(
                `INSERT INTO receitas (id, user_id, descricao, valor, created_at)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO NOTHING`,
                [r.id, r.user_id, r.descricao, r.valor, r.created_at]
            );
        }
        console.log(`💰 Receitas migradas: ${receitas.length}`);

        // 4. Metas
        const metas = await getSqliteData("metas");
        for (const m of metas) {
            await pool.query(
                `INSERT INTO metas (id, user_id, nome, valor_objetivo, valor_atual, prazo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [m.id, m.user_id, m.nome, m.valor_objetivo, m.valor_atual, m.prazo, m.created_at]
            );
        }
        console.log(`🎯 Metas migradas: ${metas.length}`);

        // 5. Investimentos
        const investimentos = await getSqliteData("investimentos");
        for (const inv of investimentos) {
            await pool.query(
                `INSERT INTO investimentos (id, user_id, ticker, tipo, quantidade, preco_medio, data_compra, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [inv.id, inv.user_id, inv.ticker, inv.tipo, inv.quantidade, inv.preco_medio, inv.data_compra, inv.created_at]
            );
        }
        console.log(`📈 Investimentos migrados: ${investimentos.length}`);

        // 6. Aportes
        const aportes = await getSqliteData("aportes");
        for (const a of aportes) {
            await pool.query(
                `INSERT INTO aportes (id, user_id, ticker, tipo, quantidade, preco_unitario, data, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [a.id, a.user_id, a.ticker, a.tipo, a.quantidade, a.preco_unitario, a.data, a.created_at]
            );
        }
        console.log(`💵 Aportes migrados: ${aportes.length}`);

        // 7. Agendamentos
        const agendamentos = await getSqliteData("agendamentos");
        for (const ag of agendamentos) {
            await pool.query(
                `INSERT INTO agendamentos (id, user_id, tipo, descricao, valor, categoria, prazo, data_agendada, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO NOTHING`,
                [ag.id, ag.user_id, ag.tipo, ag.descricao, ag.valor, ag.categoria, ag.prazo, ag.data_agendada, ag.status, ag.created_at]
            );
        }
        console.log(`📅 Agendamentos migrados: ${agendamentos.length}`);

        // 8. Históricos
        const histPat = await getSqliteData("historico_patrimonio");
        for (const hp of histPat) {
            await pool.query(
                `INSERT INTO historico_patrimonio (id, user_id, data, valor_investido, valor_atual, rendimento)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, data) DO UPDATE SET
                    valor_investido = EXCLUDED.valor_investido,
                    valor_atual = EXCLUDED.valor_atual,
                    rendimento = EXCLUDED.rendimento`,
                [hp.id, hp.user_id, hp.data, hp.valor_investido, hp.valor_atual, hp.rendimento]
            );
        }
        console.log(`📊 Histórico de Patrimônio migrado: ${histPat.length}`);

        const histAtiv = await getSqliteData("historico_ativos");
        for (const ha of histAtiv) {
            await pool.query(
                `INSERT INTO historico_ativos (id, user_id, ticker, data, valor_investido, valor_atual, rendimento)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_id, ticker, data) DO UPDATE SET
                    valor_investido = EXCLUDED.valor_investido,
                    valor_atual = EXCLUDED.valor_atual,
                    rendimento = EXCLUDED.rendimento`,
                [ha.id, ha.user_id, ha.ticker, ha.data, ha.valor_investido, ha.valor_atual, ha.rendimento]
            );
        }
        console.log(`📊 Histórico de Ativos migrado: ${histAtiv.length}`);

        // 9. Chat
        const chatConv = await getSqliteData("chat_conversas");
        for (const cc of chatConv) {
            await pool.query(
                `INSERT INTO chat_conversas (id, user_id, titulo, created_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO NOTHING`,
                [cc.id, cc.user_id, cc.titulo, cc.created_at]
            );
        }
        console.log(`💬 Conversas de chat migradas: ${chatConv.length}`);

        const chatMsg = await getSqliteData("chat_mensagens");
        for (const cm of chatMsg) {
            await pool.query(
                `INSERT INTO chat_mensagens (id, conversa_id, user_id, role, conteudo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [cm.id, cm.conversa_id, cm.user_id, cm.role, cm.conteudo, cm.created_at]
            );
        }
        console.log(`💬 Mensagens de chat migradas: ${chatMsg.length}`);

        // Ajusta as sequências (auto-increment) de cada tabela no Postgres
        const tablesWithSerial = [
            "investimentos", "gastos", "receitas", "metas", "aportes",
            "historico_patrimonio", "historico_ativos", "agendamentos",
            "chat_conversas", "chat_mensagens"
        ];
        for (const tbl of tablesWithSerial) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE(MAX(id), 1)) FROM ${tbl}`);
        }
        console.log("🔢 Sequências de ID sincronizadas com sucesso!");

        console.log("\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO! Seus dados já estão salvos no Neon PostgreSQL.");
    } catch (error) {
        console.error("❌ Erro durante a migração:", error);
    } finally {
        sqliteDb.close();
        await pool.end();
    }
}

migrar();
