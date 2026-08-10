const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(
    path.join(__dirname, "lumuzia.db")
);

function run(sql, label) {
    db.run(sql, (err) => {
        if (err) console.error(`Erro ao executar [${label}]:`, err.message);
    });
}

db.serialize(() => {
    // Ativa suporte a Chaves Estrangeiras
    run("PRAGMA foreign_keys = ON;", "PRAGMA foreign_keys");

    // Tabela de Usuários (Chave primária do Firebase UID)
    run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            nome TEXT,
            salario REAL,
            meta TEXT,
            valor_meta REAL,
            perfil TEXT
        )
    `, "create users");

    // Tabela de Investimentos (posição consolidada: 1 linha por ativo por usuário)
    run(`
        CREATE TABLE IF NOT EXISTS investimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            ticker TEXT NOT NULL,
            tipo TEXT NOT NULL,
            quantidade REAL NOT NULL,
            preco_medio REAL NOT NULL,
            data_compra TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create investimentos");

    // Tabela de Gastos
    run(`
        CREATE TABLE IF NOT EXISTS gastos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            descricao TEXT,
            valor REAL,
            categoria TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create gastos");

    // Tabela de Receitas
    run(`
        CREATE TABLE IF NOT EXISTS receitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            descricao TEXT,
            valor REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create receitas");

    // Tabela de Metas
    run(`
        CREATE TABLE IF NOT EXISTS metas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            nome TEXT,
            valor_objetivo REAL,
            valor_atual REAL DEFAULT 0,
            prazo INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create metas");

    // Tabela de Aportes: registra CADA compra individual (histórico bruto)
    run(`
        CREATE TABLE IF NOT EXISTS aportes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            ticker TEXT NOT NULL,
            tipo TEXT NOT NULL,
            quantidade REAL NOT NULL,
            preco_unitario REAL NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create aportes");

    // Snapshot diário do patrimônio total (alimenta o gráfico geral do Dashboard)
    run(`
        CREATE TABLE IF NOT EXISTS historico_patrimonio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            data TEXT NOT NULL,
            valor_investido REAL NOT NULL,
            valor_atual REAL NOT NULL,
            rendimento REAL NOT NULL,
            UNIQUE(user_id, data),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create historico_patrimonio");

    // Snapshot diário por ativo (alimenta o gráfico de rendimento individual)
    run(`
        CREATE TABLE IF NOT EXISTS historico_ativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            ticker TEXT NOT NULL,
            data TEXT NOT NULL,
            valor_investido REAL NOT NULL,
            valor_atual REAL NOT NULL,
            rendimento REAL NOT NULL,
            UNIQUE(user_id, ticker, data),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create historico_ativos");
    
        run(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            tipo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            categoria TEXT,
            prazo INTEGER,
            data_agendada TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, "create agendamentos");

    // Migração segura: só adiciona data_compra se ainda não existir
    db.all(`PRAGMA table_info(investimentos)`, (err, columns) => {
        if (err) {
            console.error("Erro ao verificar colunas de investimentos:", err.message);
            return;
        }
        const jaTemColuna = columns.some((col) => col.name === "data_compra");
        if (!jaTemColuna) {
            run(`ALTER TABLE investimentos ADD COLUMN data_compra TEXT`, "alter investimentos");
        }
    });

    // Migração ÚNICA: se "aportes" ainda está vazia, copia o estado atual de
    // "investimentos" para lá (preserva histórico) e consolida "investimentos"
    // agrupando por (user_id, ticker). Só roda uma vez.
    db.get(`SELECT COUNT(*) AS total FROM aportes`, (err, row) => {
        if (err) {
            console.error("Erro ao checar tabela de aportes:", err.message);
            return;
        }
        if (row.total > 0) return; // já migrado antes

        db.all(`SELECT * FROM investimentos`, (errInv, investimentos) => {
            if (errInv) {
                console.error("Erro ao ler investimentos para migração:", errInv.message);
                return;
            }
            if (!investimentos || investimentos.length === 0) return;

            db.serialize(() => {
                const stmtAporte = db.prepare(
                    `INSERT INTO aportes (user_id, ticker, tipo, quantidade, preco_unitario, data) VALUES (?, ?, ?, ?, ?, ?)`
                );
                investimentos.forEach((inv) => {
                    stmtAporte.run(
                        inv.user_id,
                        inv.ticker,
                        inv.tipo,
                        inv.quantidade,
                        inv.preco_medio,
                        inv.data_compra || new Date().toISOString().split("T")[0]
                    );
                });
                stmtAporte.finalize((errFinalize) => {
                    if (errFinalize) {
                        console.error("Erro ao migrar aportes:", errFinalize.message);
                        return;
                    }

                    db.all(
                        `SELECT
                            user_id,
                            ticker,
                            tipo,
                            MIN(id) AS id,
                            SUM(quantidade) AS quantidadeTotal,
                            SUM(quantidade * preco_medio) / SUM(quantidade) AS precoMedioPonderado,
                            MIN(data_compra) AS primeiraData
                         FROM investimentos
                         GROUP BY user_id, ticker`,
                        (errGrupo, grupos) => {
                            if (errGrupo) {
                                console.error("Erro ao consolidar investimentos:", errGrupo.message);
                                return;
                            }

                            db.run(`DELETE FROM investimentos`, (errDel) => {
                                if (errDel) {
                                    console.error("Erro ao limpar investimentos para consolidar:", errDel.message);
                                    return;
                                }

                                const stmtInv = db.prepare(
                                    `INSERT INTO investimentos (id, user_id, ticker, tipo, quantidade, preco_medio, data_compra) VALUES (?, ?, ?, ?, ?, ?, ?)`
                                );
                                grupos.forEach((g) => {
                                    stmtInv.run(
                                        g.id,
                                        g.user_id,
                                        g.ticker,
                                        g.tipo,
                                        g.quantidadeTotal,
                                        g.precoMedioPonderado,
                                        g.primeiraData
                                    );
                                });
                                stmtInv.finalize((errFin2) => {
                                    if (errFin2) console.error("Erro ao gravar investimentos consolidados:", errFin2.message);
                                    else console.log(`[MIGRAÇÃO] ${grupos.length} posição(ões) consolidada(s) com sucesso.`);
                                });
                            });
                        }
                    );
                });
            });
        });
    });
});

module.exports = db;