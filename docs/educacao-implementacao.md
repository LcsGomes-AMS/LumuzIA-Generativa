# Educação financeira — implementação e validação

Implementação local em 26/10/2026, seguindo o escopo atual do `plano de implementação.md`.

## Entrega

- Página existente convertida de protótipo para aplicação conectada à API autenticada, com acesso pela sidebar existente.
- Dez módulos e 38 tasks: os primeiros três cobrem os 17 tópicos iniciais e a expansão inclui dívidas, metas, renda fixa, ações, FIIs, cripto e diversificação.
- Múltipla escolha, verdadeiro/falso e situações práticas, com explicação e novas tentativas sem punição.
- Sequência obrigatória, revisão, indicação de módulo concluído, progresso, próxima aula, estados de carregamento, erro, conexão perdida e conclusão.
- Persistência por `req.uid`, XP único por task, 50 XP por módulo e 200 XP pela trilha. Os bônus são derivados das conclusões persistidas, sem gravação duplicável de recompensas.
- Níveis conforme os limiares do plano; ofensiva e melhor ofensiva com calendário `America/Sao_Paulo`, independente do fuso do servidor. Somente conclusões novas contam para a ofensiva; revisão não gera XP ou atividade adicional.
- Cifrão com interpolação de cores e efeitos graduais; transições, destaque de XP e comemoração discreta por módulo, respeitando redução de movimento.
- Certificado único por conta, nome do perfil SQL com fallback para `displayName` consultado no Firebase Admin, data real de conclusão e código aleatório de 96 bits. Nome e data ficam registrados na emissão. Nome ausente exige atualização do perfil.
- PDF real no servidor com PDFKit, logo LumuzIA, nome, curso, data e código; download autenticado. Usa Arial no Windows ou DejaVu Sans quando disponível no Linux, com fallback para a fonte padrão do PDFKit.
- Verificação de certificado autenticada e restrita ao titular, sem divulgação pública de nomes ou dados financeiros.
- Sugestões de módulos para contas sem metas e com três ou mais agendamentos de gastos parcelados pendentes. Não inferimos reserva financeira pela ausência de um registro: não existe um saldo de reserva explícito no modelo atual.
- Layout mobile com aula em tela inteira, foco visível, ciclo de foco no diálogo, saída por Escape, feedback textual e ícones de estado em CSS.

## Arquitetura e inicialização

`backend/education/education-content.js` é a fonte oficial do conteúdo. Gabaritos não ficam em arquivos estáticos nem nas respostas de leitura da API. São utilizados apenas na validação do backend; a explicação educativa é retornada após responder.

O módulo isolado `backend/education/` concentra rotas, progresso, ofensiva e certificados. O `server.js` apenas monta o router depois da autenticação, dos limites por conta/escrita e da validação global. O frontend utiliza o `apiClient.js` existente por meio de `education-api.js`.

As três tabelas são criadas com `CREATE TABLE IF NOT EXISTS` na primeira requisição autenticada de educação. A aplicação espera a criação do esquema principal; no PostgreSQL há lock transacional de migração. As mutações usam transação e bloqueio do usuário no PostgreSQL; no SQLite usam a fila transacional já existente. Há unicidade por usuário/task e usuário/certificado, consultas parametrizadas e resposta privada sem cache.

O banco existente recebe apenas tabelas adicionais. Os testes não iniciam o servidor com credenciais reais nem migram o banco de uso normal. Ao iniciar a aplicação normalmente e abrir a página, a inicialização ocorrerá no banco configurado.

## Testes

| Comando | Cobertura |
| --- | --- |
| `npm test` | 72 testes: regressões existentes e 11 verificações de educação, incluindo progressão, entrada estrita, isolamento, concorrência, replay, bônus, ofensiva, certificado e rate limit. |
| `npm run test:ui` | 20 cenários no Chrome headless: fluxos existentes e educação com resposta errada/certa, desbloqueio, revisão, reload, mobile, teclado, conexão perdida, recuperação, conclusão e download de PDF real. PDFs dos relatórios legados permanecem simulados por padrão. |
| `npm run test:security -- --json` | Suíte local de 118 verificações de segurança; relatório em `backend/security-report.json`, ignorado pelo Git. |
| `npm audit --prefer-online --cache .npm-cache` | Consulta de vulnerabilidades conhecidas das dependências. |

Também foi corrigida uma falha encontrada pela regressão da tela de Metas: o modal agora aguarda a atualização dos dados e bloqueia cliques repetidos antes de permitir a operação seguinte, evitando usar o saldo antigo após uma gravação.

A auditoria inicial das dependências encontrou três pacotes vulneráveis. Foram atualizados `body-parser` para 2.4.0, `ip-address` para 10.7.5 e `undici` para 6.29.1 dentro das faixas compatíveis. A consulta após a correção retornou zero vulnerabilidades conhecidas. PDFKit foi adicionado como dependência de produção. O componente nativo local do SQLite, inicialmente ausente, foi restaurado com `npm rebuild sqlite3`.

## Limites e fases futuras

As fases explicitamente futuras do plano continuam futuras: tutor de IA, conteúdo adaptativo, desafios diários, ranking opt-in e painel administrativo de conteúdo. Conquistas opcionais, telemetria agregada e verificação pública de certificados também não foram adicionadas. Não há nova coleta de métricas: tentativas e conclusões ficam no progresso da própria conta.

Os testes usam SQLite em memória, contas sintéticas e serviços externos simulados. O ciclo de foco e Escape são exercitados com eventos de teclado DOM na página real; não há teste com leitor de tela. As transações PostgreSQL têm testes existentes com driver simulado; esta entrega não conecta a um PostgreSQL real, não valida permissões de produção nem publica alterações. O fallback de nome Firebase é testado com resolução simulada; a consulta real exige as credenciais administrativas já previstas no projeto. Zero avisos no npm e os testes locais não equivalem a uma certificação de segurança ou auditoria da hospedagem.

As pendências de credenciais históricas e configuração externa descritas em `SECURITY.md` permanecem aplicáveis.
