const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config(); // fallback caso esteja na pasta raiz

const isPostgres = Boolean(process.env.DATABASE_URL);

let dbInstance = null;
let dbRun, dbGet, dbAll;

function toPgSql(sql) {
    let i = 1;
    let converted = sql.replace(/\?/g, () => `$${i++}`);

    // Compatibilidade de funções de data do SQLite para PostgreSQL
    converted = converted
        .replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY-MM')")
        .replace(/strftime\s*\(\s*'%Y'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY')")
        .replace(/strftime\s*\(\s*'%Y-%m-%d'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY-MM-DD')");

    // Compatibilidade INSERT OR IGNORE do SQLite para PostgreSQL
    converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi, (match, table, cols) => {
        const firstCol = cols.split(",")[0].trim();
        return `INSERT INTO ${table} (${cols}) ON CONFLICT (${firstCol}) DO NOTHING`;
    });

    return converted;
}

if (isPostgres) {
    const { Pool, types } = require("pg");

    // Trata valores numéricos e contadores para manter paridade com SQLite
    types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val))); // numeric
    types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));  // int8 / bigint
    types.setTypeParser(1114, (val) => val); // timestamp without time zone
    types.setTypeParser(1184, (val) => val); // timestamptz

    console.log("[DATABASE] Conectando ao PostgreSQL (Neon)...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on("error", (err) => {
        console.error("[DATABASE PG ERRO INESPERADO]", err);
    });

    dbRun = async (sql, params = []) => {
        const res = await pool.query(toPgSql(sql), params);
        return {
            changes: res.rowCount,
            rowCount: res.rowCount
        };
    };

    dbGet = async (sql, params = []) => {
        const res = await pool.query(toPgSql(sql), params);
        return res.rows[0];
    };

    dbAll = async (sql, params = []) => {
        const res = await pool.query(toPgSql(sql), params);
        return res.rows;
    };

    // Inicialização assíncrona das tabelas no PostgreSQL (Neon)
    (async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    nome TEXT,
                    salario REAL,
                    meta TEXT,
                    valor_meta REAL,
                    perfil TEXT
                );

                CREATE TABLE IF NOT EXISTS investimentos (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    quantidade REAL NOT NULL,
                    preco_medio REAL NOT NULL,
                    data_compra TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS gastos (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    descricao TEXT,
                    valor REAL,
                    categoria TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS receitas (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    descricao TEXT,
                    valor REAL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS metas (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    nome TEXT,
                    valor_objetivo REAL,
                    valor_atual REAL DEFAULT 0,
                    prazo INTEGER,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS aportes (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    quantidade REAL NOT NULL,
                    preco_unitario REAL NOT NULL,
                    data TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS historico_patrimonio (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    data TEXT NOT NULL,
                    valor_investido REAL NOT NULL,
                    valor_atual REAL NOT NULL,
                    rendimento REAL NOT NULL,
                    UNIQUE(user_id, data)
                );

                CREATE TABLE IF NOT EXISTS historico_ativos (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    data TEXT NOT NULL,
                    valor_investido REAL NOT NULL,
                    valor_atual REAL NOT NULL,
                    rendimento REAL NOT NULL,
                    UNIQUE(user_id, ticker, data)
                );

                CREATE TABLE IF NOT EXISTS agendamentos (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    tipo TEXT NOT NULL,
                    descricao TEXT NOT NULL,
                    valor REAL NOT NULL,
                    categoria TEXT,
                    prazo INTEGER,
                    data_agendada TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pendente',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS chat_conversas (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    titulo TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS chat_mensagens (
                    id SERIAL PRIMARY KEY,
                    conversa_id INTEGER NOT NULL REFERENCES chat_conversas(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    conteudo TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                -- Função de compatibilidade strftime no PostgreSQL
                CREATE OR REPLACE FUNCTION strftime(format text, val timestamptz)
                RETURNS text AS $$
                BEGIN
                    IF format = '%Y-%m' THEN
                        RETURN to_char(val, 'YYYY-MM');
                    ELSIF format = '%Y' THEN
                        RETURN to_char(val, 'YYYY');
                    ELSIF format = '%Y-%m-%d' THEN
                        RETURN to_char(val, 'YYYY-MM-DD');
                    ELSE
                        RETURN to_char(val, 'YYYY-MM-DD');
                    END IF;
                END;
                $$ LANGUAGE plpgsql IMMUTABLE;

                CREATE OR REPLACE FUNCTION strftime(format text, val text)
                RETURNS text AS $$
                BEGIN
                    RETURN strftime(format, val::timestamptz);
                EXCEPTION WHEN OTHERS THEN
                    RETURN val;
                END;
                $$ LANGUAGE plpgsql IMMUTABLE;
            `);

            console.log("[DATABASE] Tabelas e funções no PostgreSQL (Neon) inicializadas com sucesso!");
        } catch (err) {
            console.error("[DATABASE ERRO PG INIT]", err);
        }
    })();

    dbInstance = pool;
} else {
    const sqlite3 = require("sqlite3").verbose();
    console.log("[DATABASE] DATABASE_URL não configurada. Usando SQLite local (lumuzia.db)...");

    const sqliteDb = new sqlite3.Database(path.join(__dirname, "lumuzia.db"));

    function run(sql, label) {
        sqliteDb.run(sql, (err) => {
            if (err) console.error(`Erro ao executar [${label}]:`, err.message);
        });
    }

    sqliteDb.serialize(() => {
        run("PRAGMA foreign_keys = ON;", "PRAGMA foreign_keys");

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

        run(`
            CREATE TABLE IF NOT EXISTS chat_conversas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                titulo TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, "create chat_conversas");

        run(`
            CREATE TABLE IF NOT EXISTS chat_mensagens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversa_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                conteudo TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversa_id) REFERENCES chat_conversas(id) ON DELETE CASCADE
            )
        `, "create chat_mensagens");

        sqliteDb.all("PRAGMA table_info(investimentos)", (err, columns) => {
            if (err) return;
            const jaTemColuna = columns.some((col) => col.name === "data_compra");
            if (!jaTemColuna) {
                run("ALTER TABLE investimentos ADD COLUMN data_compra TEXT", "alter investimentos");
            }
        });
    });

    dbRun = (sql, params = []) => new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) {
            if (err) reject(err); else resolve(this);
        });
    });

    dbGet = (sql, params = []) => new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });

    dbAll = (sql, params = []) => new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    dbInstance = sqliteDb;
}

const exported = dbInstance;
exported.db = dbInstance;
exported.dbRun = dbRun;
exported.dbGet = dbGet;
exported.dbAll = dbAll;
exported.isPostgres = isPostgres;

module.exports = exported;