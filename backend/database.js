const { Pool } = require("pg");

// Configura o Pool de conexão com o PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Erro inesperado no PostgreSQL', err);
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log("Iniciando verificação de tabelas no PostgreSQL...");

        // Tabela de Usuários
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nome TEXT,
                salario REAL,
                meta TEXT,
                valor_meta REAL,
                perfil TEXT
            )
        `);

        // Tabela de Investimentos
        await client.query(`
            CREATE TABLE IF NOT EXISTS investimentos (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                tipo TEXT NOT NULL,
                quantidade REAL NOT NULL,
                preco_medio REAL NOT NULL,
                data_compra TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela de Gastos
        await client.query(`
            CREATE TABLE IF NOT EXISTS gastos (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                descricao TEXT,
                valor REAL,
                categoria TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela de Receitas
        await client.query(`
            CREATE TABLE IF NOT EXISTS receitas (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                descricao TEXT,
                valor REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela de Metas
        await client.query(`
            CREATE TABLE IF NOT EXISTS metas (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                nome TEXT,
                valor_objetivo REAL,
                valor_atual REAL DEFAULT 0,
                prazo INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela de Aportes
        await client.query(`
            CREATE TABLE IF NOT EXISTS aportes (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                tipo TEXT NOT NULL,
                quantidade REAL NOT NULL,
                preco_unitario REAL NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela Historico Patrimonio
        await client.query(`
            CREATE TABLE IF NOT EXISTS historico_patrimonio (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                data TEXT NOT NULL,
                valor_investido REAL NOT NULL,
                valor_atual REAL NOT NULL,
                rendimento REAL NOT NULL,
                UNIQUE(user_id, data),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela Historico Ativos
        await client.query(`
            CREATE TABLE IF NOT EXISTS historico_ativos (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                data TEXT NOT NULL,
                valor_investido REAL NOT NULL,
                valor_atual REAL NOT NULL,
                rendimento REAL NOT NULL,
                UNIQUE(user_id, ticker, data),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    
        // Tabela Agendamentos
        await client.query(`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                tipo TEXT NOT NULL,
                descricao TEXT NOT NULL,
                valor REAL NOT NULL,
                categoria TEXT,
                prazo INTEGER,
                data_agendada TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pendente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela Chat Conversas
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_conversas (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                titulo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tabela Chat Mensagens
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_mensagens (
                id SERIAL PRIMARY KEY,
                conversa_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                conteudo TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversa_id) REFERENCES chat_conversas(id) ON DELETE CASCADE
            )
        `);

        console.log("Migração PostgreSQL concluída com sucesso.");
    } catch (error) {
        console.error("Erro ao criar tabelas no PostgreSQL:", error);
    } finally {
        client.release();
    }
}

// Roda a migração de tabelas assincronamente ao iniciar
runMigration();

// Exporta o pool de conexão para ser usado em server.js com suporte à sintaxe posicional `?`
module.exports = {
    // Wrapper para executar comandos adaptando `?` para `$1`, `$2`
    query: async (sql, params = []) => {
        let index = 1;
        const pgSql = sql.replace(/\?/g, () => `$${index++}`);
        return await pool.query(pgSql, params);
    },
    // Retorna o pool para uso direto, se necessário
    pool
};