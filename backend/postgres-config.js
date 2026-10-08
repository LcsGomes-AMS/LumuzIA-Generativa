"use strict";

// pg permite parâmetros SSL na URL sobrescreverem o objeto ssl do Pool.
// Normalizamos só em memória para impor verificação de certificado e hostname.
module.exports = function postgresConfig(connectionString) {
    let url;
    try { url = new URL(connectionString); }
    catch { throw new Error("DATABASE_URL inválida."); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
        throw new Error("DATABASE_URL deve apontar para PostgreSQL.");
    }
    const sslParams = new Set(["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat", "sslnegotiation"]);
    for (const key of [...url.searchParams.keys()]) {
        if (sslParams.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    return {
        connectionString: url.toString(),
        ssl: { rejectUnauthorized: true },
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        statement_timeout: 15000,
        query_timeout: 20000
    };
};
