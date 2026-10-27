# Auditoria local de cibersegurança — 26/10/2026

## Escopo e resultados

Testes em localhost, SQLite em memória, contas sintéticas e serviços externos simulados. Nenhum ataque foi enviado à produção, nenhuma credencial foi revogada e nenhum banco real foi alterado.

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test` | 72/72 aprovados, nenhum ignorado; inclui autenticação, autorização, transações, TLS PostgreSQL com driver simulado, ponte PHP, Apache e educação |
| `npm.cmd run test:security -- --json` | 118/118 aprovados; nenhum aviso ou falha |
| `npm.cmd run test:db` | Aprovado: leitura, escrita, commit, rollback e limpeza isolados |
| `npm.cmd run test:ui`, com `CHROME_PATH` apontando para Edge e `UI_REAL_PDF=1` | 20/20 aprovados; XSS, CSP, isolamento de tokens, troca de conta e PDFs reais |
| `npm.cmd audit --json` | Zero vulnerabilidades conhecidas reportadas, 335 dependências |
| `npm.cmd run test:firestore`, com Java 21 e emulador oficial 1.19.8 | 10/10 aprovados, nenhum ignorado; dono, outra conta, anônimo, campos proibidos, listagem e coleções não declaradas |
| Busca adicional em 83 arquivos rastreados | Nenhum padrão de chave privada, conta de serviço Google, token GitHub ou access key AWS encontrado; busca limitada, não substitui detector completo de segredos |

O relatório detalhado da suíte HTTP fica em `backend/security-report.json` (ignorado pelo Git). Os testes aprovados não cobrem todas as propriedades de segurança: a revisão adicional abaixo encontrou comportamento deliberadamente aceito pela suíte atual.

## Achado: autenticação continua sem consulta de revogação

**Atualização: corrigido localmente nesta revisão.** O histórico do achado abaixo descreve a versão anterior. O fallback foi removido em todos os ambientes: a verificação usa sempre `verifyIdToken(token, true)`. Os três erros de infraestrutura retornam 503 sanitizado, sem atribuir identidade nem liberar a rota. Tokens revogados e contas desativadas continuam recebendo 401.

Novas regressões reproduziram quatro falhas antes da correção. Cobrem os três erros em produção, desenvolvimento e teste, ausência de identidade, ausência de segunda chamada sem revogação, resposta sem detalhes internos e recuperação após indisponibilidade. Um teste adicional do cliente confirma que 503 preserva a sessão e permite nova tentativa sem renovação automática do token.

Validação após a alteração: `npm.cmd test` com 76 testes e `npm.cmd run test:security -- --json` com 118 verificações, todos aprovados. O ambiente precisa de credenciais Firebase Admin válidas e permissões para consultar usuários; sem isso, as rotas privadas passam a recusar acesso em vez de reduzir a proteção.

**Prioridade alta; impacto depende de falha/configuração do Firebase Admin.**

Em `backend/firebaseAdmin.js:65`, os erros `app/invalid-credential`, `auth/insufficient-permission` e `auth/internal-error` causam uma nova chamada a `verifyIdToken(token, false)`. Essa chamada verifica o token, mas não consulta revogação ou desativação da conta. Portanto a garantia de rejeitar sessões revogadas fica indisponível nesses caminhos. Não permite forjar uma assinatura JWT.

Reprodução adicional com o middleware real executado em VM, `NODE_ENV=production` e SDK simulado: para cada um dos três erros, a primeira chamada usou `true`, a segunda usou `false`, e o middleware chamou `next()`. Não foi usado token real nem feita consulta ao Firebase.

O teste existente “servidor sem credencial administrativa valida assinatura JWT via chaves públicas sem derrubar a sessão” exige esse comportamento; por isso a suíte verde não elimina o achado.

Recomendação original atendida no código e nos testes. O provisionamento e a verificação das permissões reais no provedor continuam pendentes.

## Credenciais em histórico Git

O histórico contém referências a `backup/backup-v0.88.zip` e `backup/backup-v0.93.zip`. Esses arquivos não estão rastreados no estado atual. `SECURITY.md` já registra que continham credenciais e bancos; o conteúdo dos arquivos históricos não foi extraído nesta auditoria. Não foi possível confirmar revogação das credenciais antigas. Essa pendência continua prioritária: verificar a revogação nos provedores e planejar limpeza do histórico com os colaboradores.

## Limites

Não foram auditados IAM, regras publicadas no Firebase, certificados HTTPS da hospedagem, sistema operacional, restauração de backups, infraestrutura de rede nem um PostgreSQL real. Rate limits em múltiplas réplicas também exigem validação externa. Não houve teste de carga destrutivo.

O primeiro comando Firestore foi ignorado por ausência das variáveis do emulador. Depois foi baixado o emulador oficial 1.19.8 de `storage.googleapis.com/firebase-preview-drop/emulator/`, em diretório temporário fora do repositório, e executado com o Java 21 instalado, projeto `demo-lumuz-security` e conexão exclusivamente local. Os dez testes passaram; nenhuma regra foi publicada. Os binários temporários não são dependências da aplicação.
