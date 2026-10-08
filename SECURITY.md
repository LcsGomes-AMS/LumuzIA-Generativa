# Segurança do LumuzIA

Revisão local em 08/10/2026. Foram usados dados sintéticos `sec_test_*`, SQLite em memória e serviços simulados. Nenhum banco real foi migrado, limpo ou alterado; não houve publicação nem alteração de credenciais externas.

## Correções implementadas

| Achado | Impacto | Correção e evidência |
| --- | --- | --- |
| Escrita e alteração de título de conversa de outra conta | Crítico: integridade e isolamento de contas | Validação de proprietário antes da IA e em cada gravação; regressão de IDOR no chat. |
| ZIPs versionados com `.env`, `serviceAccountKey.json` e bancos | Crítico: credenciais e dados privados | ZIPs retirados do índice Git e ignorados, preservando os arquivos locais. **Chaves antigas e histórico ainda exigem tratamento externo descrito abaixo.** |
| Verificação TLS desativada no PostgreSQL e migração | Alto: interceptação da conexão | Certificado e hostname verificados; parâmetros SSL da URL não podem substituir a política segura; testes do driver e de configuração. |
| Bypass `x-test-uid` no middleware real | Alto: risco de autenticação sob configuração incorreta | Removido integralmente do runtime. Mocks são injetados exclusivamente pelos testes. |
| Tokens revogados ou contas desativadas | Alto: sessão continuava aceita | Firebase Admin verifica revogação em todas as chamadas; tokens anônimos, inválidos e excessivos recusados. |
| Foto e atributos HTML interpolados; eventos inline liberados | Alto: XSS e roubo de sessão | URLs de foto validadas, criação de elementos DOM, codificação de texto/atributos e ações registradas sem código em atributos. CSP proíbe scripts/eventos inline. |
| Cliente podia enviar token a outra origem | Alto: exposição do token | Cliente aceita apenas caminhos locais, impede redirecionamentos e bloqueia resultado após troca de conta. |
| Ponte PHP pública com ações administrativas e escolha de modelo | Alto: uso indevido de IA e consumo de recursos | Segredo compartilhado só entre servidores, comparação segura, ausência de CORS público, modelo fixo, destino localhost fixo, limites de corpo, saída, tempo e concorrência. |
| Dependências vulneráveis | Crítico/alto/médio | 12 avisos iniciais do npm corrigidos; dependências sem uso removidas, versões atualizadas e lockfile renovado. Bibliotecas CDN fixadas e atualizadas. |
| Agendamentos e aportes concorrentes | Alto: duplicação e perda de atualização financeira | Transações, mudança condicional de estado e bloqueio por usuário no PostgreSQL. Regressões concorrentes e rollback SQLite; contrato PostgreSQL testado com driver simulado. |
| CORS permissivo, limites só em `/api`, entradas sem validação | Médio/alto: abuso e dados inválidos | Origens restritas, limites por IP/conta/operação, cotas de registros, validação de tipos, datas, valores, IDs, modelo, conteúdo e profundidade. |
| Diagnóstico com contagens globais e erros internos | Médio: exposição de dados | Diagnóstico retorna apenas contagens da própria conta; respostas e logs de erro sanitizados, respostas privadas `no-store`. |
| Testes escreviam no banco ativo | Alto: integridade dos dados | `NODE_ENV=test` ignora `.env` e `DATABASE_URL` e força SQLite `:memory:`; chamadas externas bloqueadas na suíte HTTP. |

## Ação necessária para as credenciais antigas

Os dois ZIPs locais em `backup/` incluíam `.env`, chaves administrativas Firebase e bancos. A auditoria verificou somente os nomes dos arquivos, sem imprimir seu conteúdo. Retirar arquivos do próximo commit **não remove cópias de commits antigos**, clones, forks ou downloads.

1. No projeto Google Cloud/Firebase, identifique e revogue as chaves administrativas que apareceram nesses ZIPs. Gere substitutas somente onde necessário e atualize o ambiente privado do servidor.
2. Verifique quais outros segredos estavam nos `.env` históricos e substitua os correspondentes no provedor. Não cole credenciais em issues, chats ou commits.
3. Restrinja o acesso ao repositório e aos backups. Se o histórico foi compartilhado, trate as chaves como expostas e revise os registros de acesso do provedor.
4. A limpeza do histórico Git deve ser planejada com os colaboradores, pois reescreve commits. Não foi executada automaticamente nesta revisão. Revogar as chaves vem antes da limpeza.

O acesso ao painel e a rotação de chaves não foram executados. Os ZIPs e bancos locais foram preservados. A remoção do rastreamento dos ZIPs está preparada no índice Git e deve entrar no próximo commit junto das correções.

## Configuração da aplicação

- Use Node.js 22 ou superior e uma versão PHP com suporte de segurança e os patches atuais do provedor. O PHP local encontrado para os testes foi 8.2.12; a instalação global do XAMPP não foi atualizada.
- Use `.env.example` como referência sem versionar o `.env` real. O Firebase Admin precisa de credenciais válidas para consultar revogação: `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT_JSON` ou Application Default Credentials. A chave do cliente Firebase em `frontend/js/config.js` é um identificador público; a proteção dos dados depende da autenticação e das regras, não de esconder esse identificador.
- Sirva a aplicação pelo Node (`npm start`). Publique somente os arquivos necessários da ponte PHP em sua própria raiz pública. Nunca use o repositório inteiro como diretório público. O `.htaccess` fornecido é uma proteção adicional para Apache 2.4 com `AllowOverride` e `mod_rewrite` habilitados; outros servidores precisam de regra equivalente. A configuração do host não foi alterada nem verificada.
- Configure HTTPS no ingresso da aplicação e da ponte. HSTS está ativo, mas não provisiona certificados. `TRUST_PROXY_HOPS` começa em `0`; configure apenas a quantidade exata de proxies confiáveis do host, sem permitir acesso direto que contorne essa cadeia.
- Para frontend/API em origens diferentes, configure `CORS_ORIGINS` com as origens exatas. Sem lista, o servidor aceita sua própria origem e localhost no desenvolvimento; não reflete origens arbitrárias nem usa credenciais CORS.
- O chat exige `OLLAMA_URL` e `OLLAMA_BRIDGE_SECRET` iguais no Node/PHP; o segredo deve ser aleatório, sem espaços, com 32–256 caracteres. `OLLAMA_MODEL` é definido no servidor, padrão `llama3.2:1b`. Sem configuração segura, o chat retorna 503. HTTPS é obrigatório na ponte em produção; HTTP é aceito somente em localhost fora de produção. O Ollama deve escutar apenas em localhost no servidor PHP.
- Revise e publique `firestore.rules` no projeto correto para restringir `users/{uid}` e `usuarios/{uid}` ao proprietário autenticado e rejeitar contas anônimas. O arquivo `firebase.json` aponta para essas regras. Elas compilaram e passaram em 10 testes no emulador oficial, usando um projeto `demo-*` isolado; não foram publicadas no Firebase nesta revisão. Regras atualmente em produção, origens autorizadas do Auth, permissões IAM e proteção contra abuso de criação de contas dependem do painel externo.
- SQLite local precisa de armazenamento persistente e backup privado; PostgreSQL exige URL correta e certificado válido. Backups/recuperação do host não são garantidos por estes testes.

## Validação reproduzível

Execute com Node.js compatível:

```text
npm ci
npm test
npm run test:security
npm run test:db
npm run test:ui
npm run test:firestore
npm audit --omit=dev
```

Resultados finais: 60/60 testes integrados, sem testes ignorados; 118/118 verificações na suíte de segurança; 17/17 cenários no Chrome com PDF real; 10/10 testes das regras Firestore; auditoria npm sem vulnerabilidades reportadas. O teste Apache com arquivos sentinela também confirmou que a raiz da ponte bloqueia configurações, chaves, bancos, backups e diretórios internos.

`npm test` reúne autenticação, rotas, agendamentos, TLS/banco, integração PHP e proteção Apache. A suíte PHP exige PHP acessível ou `PHP_BINARY`; indisponibilidade aparece explicitamente como teste ignorado. O teste Apache exige `HTTPD_BINARY` e instalação com seus módulos; a configuração externa de produção continua sem validação. `test:ui` usa Chrome local ou `CHROME_PATH`.

Para repetir o teste Firestore, defina `JAVA_BINARY` para Java 21+ e `FIRESTORE_EMULATOR_JAR` para o emulador oficial, então execute `npm run test:firestore`. Os executáveis portáteis usados nesta revisão ficaram em diretório temporário fora do repositório; não há dependência nova de Java na aplicação. O teste só se conecta a localhost, com projeto de demonstração e dados sintéticos. Para validar os bundles PDF reais, execute `test:ui` com `UI_REAL_PDF=1`; somente os arquivos públicos do CDN são baixados, Firebase/IA/cotações permanecem simulados.

Os testes não certificam ausência de vulnerabilidades. Não foram realizados ataques a serviços externos, auditoria de produção, inspeção do conteúdo de credenciais, rotação remota, migração de dados, reescrita de histórico ou atualização do sistema operacional. Limites em memória são por instância Node; múltiplas réplicas devem compartilhar limites no ingresso quando for necessário um orçamento global.

## Referências de implementação

- [SSL e parâmetros de conexão do node-postgres](https://node-postgres.com/features/ssl).
- [Revogação de sessões Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions).
- [Notas de versão Firebase Admin](https://firebase.google.com/support/release-notes/admin/node) e [Firebase JavaScript](https://firebase.google.com/support/release-notes/js).
- [Correção de proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [jsPDF](https://github.com/parallax/jsPDF/releases) e [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable/releases).
