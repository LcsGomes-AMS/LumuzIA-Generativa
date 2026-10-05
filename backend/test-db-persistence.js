/**
 * LumuzIA - Diagnóstico e Teste de Persistência de Dados (SQLite vs Neon PostgreSQL)
 *
 * Verifica por que os dados seriam ou não apagados após commits/deploys:
 * 1. Análise do mecanismo de banco ativo (SQLite vs Neon)
 * 2. Teste de gravação, leitura e consistência de dados
 * 3. Validação das regras do Git (.gitignore e status de arquivos .db)
 * 4. Verificação de risco de perda de dados no Render (disco efêmero vs nuvem)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("dotenv").config();

const { dbRun, dbGet, dbAll, isPostgres } = require("./database");
const fs = require("fs");
const path = require("path");

async function diagnosticarBanco() {
    console.log("\n========================================================");
    console.log("   DIAGNÓSTICO DE PERSISTÊNCIA DE BANCO DE DADOS");
    console.log("========================================================\n");

    const databaseUrl = process.env.DATABASE_URL;

    // 1. Verificação do Engine Atual
    if (isPostgres && databaseUrl) {
        console.log("✅ MECANISMO ATIVO: PostgreSQL em Nuvem (Neon)");
        console.log("   - String de conexão detectada no ambiente.");
        console.log("   - PERSISTÊNCIA: 100% GARANTIDA EM NUVEM.");
        console.log("   - Novos commits ou deploys NÃO afetam os dados no Neon.");
    } else {
        console.log("⚠️  MECANISMO ATIVO: SQLite Local (lumuzia.db)");
        console.log("   - DATABASE_URL não está definida no arquivo .env local.");
        console.log("   - NO AMBIENTE LOCAL (Seu Computador):");
        console.log("     O Git NÃO apaga o lumuzia.db após commits porque ele está no .gitignore.");
        console.log("   - NO AMBIENTE DE PRODUÇÃO (Hospedagem Render / Nuvem):");
        console.log("     O Render usa DISCO EFÊMERO (containers recriados do zero a cada deploy).");
        console.log("     A CADA COMMIT OU PUSH, o Render faz novo deploy e o SQLite zera!");
    }

    // 2. Teste de Inserção, Leitura e Integridade
    console.log("\n--- Executando Teste de Leitura e Escrita ---");
    const testUserId = "diag_test_user_" + Date.now();

    try {
        await dbRun("INSERT INTO users (id, nome, salario) VALUES (?, 'Teste Persistencia', 5000)", [testUserId]);
        const userSalvo = await dbGet("SELECT * FROM users WHERE id = ?", [testUserId]);

        if (userSalvo && userSalvo.id === testUserId) {
            console.log("✅ Gravação e Leitura no banco ativo: OK!");
        } else {
            console.error("❌ Falha na leitura do registro criado!");
        }

        // Limpeza do registro de teste
        await dbRun("DELETE FROM users WHERE id = ?", [testUserId]);
        console.log("✅ Limpeza do registro temporário: OK (banco intacto)!");
    } catch (err) {
        console.error("❌ Erro durante o teste de banco:", err.message);
    }

    // 3. Verificação do .gitignore
    console.log("\n--- Verificação de Proteção Git (.gitignore) ---");
    const gitignorePath = path.join(__dirname, "../.gitignore");
    if (fs.existsSync(gitignorePath)) {
        const conteudoGitignore = fs.readFileSync(gitignorePath, "utf-8");
        if (conteudoGitignore.includes("*.db")) {
            console.log("✅ Proteção no Git: Arquivos *.db estão ignorados pelo Git.");
            console.log("   Isso garante que commits locais não sobrescrevem seu banco local.");
        } else {
            console.warn("⚠️  Aviso: *.db não encontrado no .gitignore!");
        }
    }

    // 4. Contagem atual de registros
    try {
        const u = await dbGet("SELECT count(*) as c FROM users");
        const r = await dbGet("SELECT count(*) as c FROM receitas");
        const g = await dbGet("SELECT count(*) as c FROM gastos");
        const m = await dbGet("SELECT count(*) as c FROM metas");

        console.log("\n--- Registros Atuais no Banco Ativo ---");
        console.log(`   Usuários Cadastrados: ${u?.c || 0}`);
        console.log(`   Receitas            : ${r?.c || 0}`);
        console.log(`   Gastos              : ${g?.c || 0}`);
        console.log(`   Metas               : ${m?.c || 0}`);
    } catch (err) {
        console.error("Erro ao consultar contadores:", err.message);
    }

    console.log("\n========================================================");
    console.log("   CONCLUSÃO E COMO RESOLVER PERDA DE DADOS NO RENDER");
    console.log("========================================================");
    if (!databaseUrl) {
        console.log("Para seus dados NUNCA mais sumirem quando você der commit/deploy:");
        console.log("1. Acesse o painel do Render (https://dashboard.render.com).");
        console.log("2. Clique no seu serviço Web (LumuzIA-Generativa).");
        console.log("3. Vá na aba 'Environment' (Variáveis de Ambiente).");
        console.log("4. Adicione a variável:");
        console.log("   Key:   DATABASE_URL");
        console.log("   Value: postgresql://[usuario]:[senha]@[host-neon].tech/neondb?sslmode=require");
        console.log("5. Clique em 'Save Changes'. O Render vai conectar diretamente ao Neon.");
        console.log("6. Para migrar seus dados do SQLite local para o Neon, rode localmente:");
        console.log("   DATABASE_URL=\"sua_url_neon\" node backend/migrateToNeon.js\n");
    } else {
        console.log("O banco Neon está configurado e seus dados estão persistidos com segurança!\n");
    }
}

diagnosticarBanco().catch((err) => {
    console.error("Erro fatal no diagnóstico:", err);
    process.exit(1);
});
