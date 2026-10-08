const path = require("path");
const { AsyncLocalStorage } = require("node:async_hooks");
const postgresConfig = require("./postgres-config");
// Testes nunca carregam credenciais nem conectam ao banco persistente.
const isTest = process.env.NODE_ENV === "test";
if (!isTest) {
    require("dotenv").config({ path: path.join(__dirname, "../.env") });
    require("dotenv").config();
}
const isPostgres = !isTest && Boolean(process.env.DATABASE_URL);
const transactionScope = new AsyncLocalStorage();

let dbInstance = null;
let dbRun, dbGet, dbAll, dbTransaction;

function toPgSql(sql) {
    let i = 1;
    let converted = sql.replace(/\?/g, () => `$${i++}`);

    // Compatibilidade de funções de data do SQLite para PostgreSQL
    converted = converted
        .replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY-MM')")
        .replace(/strftime\s*\(\s*'%Y'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY')")
        .replace(/strftime\s*\(\s*'%Y-%m-%d'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "to_char($1, 'YYYY-MM-DD')");

    // Compatibilidade IFNULL do SQLite para PostgreSQL
    converted = converted.replace(/IFNULL\s*\(/gi, "COALESCE(");

    // ON CONFLICT vem depois de VALUES, antes de RETURNING.
    const ignore = /INSERT\s+OR\s+IGNORE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i.exec(converted);
    if (ignore) {
        converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO").replace(/;\s*$/, "");
        const conflict = ` ON CONFLICT (${ignore[2].split(",")[0].trim()}) DO NOTHING`;
        const returning = /\s+RETURNING\b/i.exec(converted);
        converted = returning
            ? converted.slice(0, returning.index) + conflict + converted.slice(returning.index)
            : converted + conflict;
    }

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

    const pool = new Pool(postgresConfig(process.env.DATABASE_URL));
    pool.on("error", () => console.error("[DATABASE] Falha inesperada na conexão PostgreSQL."));

    function accessFor(client) {
        return {
            async dbRun(sql, params = []) {
                let statement = toPgSql(sql).replace(/;\s*$/, "");
                if (/^\s*INSERT\s+INTO\b/i.test(statement) && !/\bRETURNING\b/i.test(statement)) {
                    statement += " RETURNING id";
                }
                const res = await client.query(statement, params);
                return { changes: res.rowCount, rowCount: res.rowCount, lastID: res.rows[0]?.id };
            },
            async dbGet(sql, params = []) {
                return (await client.query(toPgSql(sql), params)).rows[0];
            },
            async dbAll(sql, params = []) {
                return (await client.query(toPgSql(sql), params)).rows;
            }
        };
    }
    ({ dbRun, dbGet, dbAll } = accessFor(pool));
    dbTransaction = async (callback) => {
        if (transactionScope.getStore()) throw new Error("Transação aninhada não permitida.");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const tx = accessFor(client);
            const result = await transactionScope.run(tx, () => callback(tx));
            await client.query("COMMIT");
            return result;
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
        } finally {
            client.release();
        }
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
            console.error("[DATABASE] Não foi possível inicializar o PostgreSQL.");
        }
    })();

    dbInstance = pool;
} else {
    const sqlite3 = require("sqlite3").verbose();
    console.log(isTest ? "[DATABASE] Teste isolado: SQLite em memória." : "[DATABASE] Usando SQLite local (lumuzia.db).");

    const sqliteDb = new sqlite3.Database(isTest ? ":memory:" : path.join(__dirname, "lumuzia.db"));

    function run(sql, label) {
        sqliteDb.run(sql, (err) => {
            if (err) console.error(`[DATABASE] Falha na inicialização: ${label}.`);
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

    const raw = {
        dbRun: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (err) {
                if (err) reject(err); else resolve({ changes: this.changes, lastID: this.lastID });
            });
        }),
        dbGet: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        }),
        dbAll: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        })
    };
    // Uma única conexão SQLite: até consultas fora da transação aguardam o COMMIT.
    let pending = Promise.resolve();
    function enqueue(operation) {
        const result = pending.then(operation);
        pending = result.catch(() => {});
        return result;
    }
    dbRun = (...args) => enqueue(() => raw.dbRun(...args));
    dbGet = (...args) => enqueue(() => raw.dbGet(...args));
    dbAll = (...args) => enqueue(() => raw.dbAll(...args));
    dbTransaction = (callback) => {
        if (transactionScope.getStore()) return Promise.reject(new Error("Transação aninhada não permitida."));
        return enqueue(async () => {
            await raw.dbRun("BEGIN IMMEDIATE");
            try {
                const result = await transactionScope.run(raw, () => callback(raw));
                await raw.dbRun("COMMIT");
                return result;
            } catch (error) {
                await raw.dbRun("ROLLBACK").catch(() => {});
                throw error;
            }
        });
    };

    dbInstance = sqliteDb;
}

const exported = dbInstance;
exported.db = dbInstance;
const directAccess = { dbRun, dbGet, dbAll };
for (const method of Object.keys(directAccess)) {
    exported[method] = (...args) => (transactionScope.getStore() || directAccess)[method](...args);
}
exported.dbTransaction = dbTransaction;
exported.isPostgres = isPostgres;

module.exports = exported;