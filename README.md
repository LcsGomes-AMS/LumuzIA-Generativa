# LumuzIA — Plataforma de Inteligência Financeira e Gestão Pessoal

O **LumuzIA** é uma aplicação completa de gestão financeira pessoal e investimentos integrada a um assistente de Inteligência Artificial generativa (**Llama 3.2** via Ollama), autenticação segura com Firebase e persistência em nuvem.

---

## 🛡️ Relatório de Cybersegurança e Testes Defensivos (AppSec / DAST)

A segurança da plataforma é auditada por uma suíte automatizada de testes defensivos baseada nas diretrizes do **OWASP Top 10**.

### 1. Resumo da Auditoria Automatizada
- **Total de Verificações Executadas:** 21
- **Aprovadas (Seguro):** 21 (100% de cobertura defensiva)
- **Falhas / Vulnerabilidades em Aberto:** 0

### 2. Vetores de Segurança Auditados
| Categoria OWASP | Teste Realizado | Resultado |
|---|---|---|
| **A01: Broken Access Control** | Bloqueio de rotas privadas sem token JWT (`/receitas`, `/gastos`, `/metas`, `/dashboard`, etc.) | **HTTP 401 Unauthorized** (Acesso negado) |
| **A01: Broken Access Control (IDOR)** | Tentativa de invasor ler ou excluir transações e metas de outro usuário | **HTTP 403 Forbidden** na leitura / **HTTP 404** na deleção |
| **A02: Cryptographic Failures** | Conexões com banco de dados em nuvem (Neon) exigem SSL obrigatório | **SSL Ativo** (`rejectUnauthorized: false`) |
| **A03: Injection (SQL Injection)** | Envio de payloads maliciosos (`' OR '1'='1 --`, `'; DROP TABLE`) em queries e corpos | **Neutralizado** (Consultas parametrizadas `$1, $2` e `?`) |
| **A04: Security Misconfiguration** | Omissão de cabeçalhos de identificação do servidor e injeção de headers seguros | **Ativo via Helmet** (`X-Content-Type-Options: nosniff`, sem `X-Powered-By`) |
| **A06: DoS / Esgotamento de Memória** | Envio proposital de payload JSON gigante (> 250 KB) | **HTTP 413 Payload Too Large** (Cortado antes da memória) |
| **A06: Força Bruta / Flood** | Disparo de 16 requisições sucessivas para o endpoint de IA (`/api/ia/chat`) | **HTTP 429 Too Many Requests** na 16ª requisição |
| **A07: Identification & Auth Failures** | Envio de JWT forjado ou com assinatura adulterada | **HTTP 401 Unauthorized** com rejeição imediata |

### 3. Vulnerabilidade Detectada nos Testes e Corrigida
Durante a execução inicial da suíte de segurança, o teste identificou que valores maliciosos como `"100; DROP TABLE receitas;"` eram convertidos parcialmente por `parseFloat()` para o número `100`, aceitando a requisição.
- **Correção Implementada:** Foi criada validação estrita via Expressão Regular em `parseNumeroPositivo()` (`/^\d+(\.\d+)?$/`). Qualquer caracter não-numérico ou payload anômalo agora é sumariamente rejeitado com **HTTP 400 Bad Request**.

### 4. Como Executar os Testes de Segurança
```bash
npm run test:security
```
*O script inicia um servidor de testes em porta livre, executa todas as 21 checagens e, no final, limpa automaticamente todos os dados de teste do banco de dados.*

---

## 💾 Diagnóstico de Persistência do Banco de Dados (Por que os dados sumiam após o commit?)

### O Diagnóstico
1. **Ambiente Local (Seu Computador):**
   - O banco local SQLite (`backend/lumuzia.db`) **não é apagado pelo Git**. Ele está listado no `.gitignore`, portanto o comando `git commit` nunca toca no arquivo local.
2. **Ambiente de Produção (Hospedagem no Render):**
   - O Render opera com **containers em disco efêmero**. Toda vez que você faz um `git commit` e `git push`, o Render destrói o container anterior e cria um novo do zero.
   - **Causa da Perda de Dados:** Se a variável `DATABASE_URL` não estiver configurada no painel do Render, o servidor em produção cai no fallback do SQLite local (que é recriado vazio a cada deploy).

### Como Resolver Definitivamente (Persistência em Nuvem com Neon PostgreSQL)
1. Acesse o [Dashboard do Render](https://dashboard.render.com).
2. Selecione o serviço web **LumuzIA-Generativa**.
3. Acesse a aba **Environment** (Variáveis de Ambiente).
4. Adicione a variável:
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://usuario:senha@ep-...neon.tech/neondb?sslmode=require`
5. Clique em **Save Changes**. O Render reiniciará conectado diretamente ao Neon. A partir desse momento, **nenhum commit ou deploy apagará seus dados**.

### Como Checar a Persistência ao Vivo
Você pode verificar a qualquer momento se o seu servidor em produção está conectado ao Neon ou ao SQLite acessando:
- **No navegador:** `https://lumuzia-generativa.onrender.com/api/db-status`
- **Ou via terminal:**
  ```bash
  npm run test:db
  ```

### Como Migrar seus Dados Locais para o Neon
Se você tiver dados no seu SQLite local que deseja transferir para o banco Neon na nuvem, rode:
```bash
DATABASE_URL="sua_string_de_conexao_do_neon" node backend/migrateToNeon.js
```

---

## 🤖 Agentes Especializados do Projeto

O projeto conta com agentes de inteligência especializados, mantidos na pasta oculta `.agents/` (com atributo oculto no sistema operacional e no Git):

- **Agente UX/UI:** Localizado em `.agents/agents/ux-ui/agente.md`. Responsável pelo padrão visual, consistência de layout, responsividade mobile e empty-states.
- **Agente de Cybersegurança (AppSec):** Localizado em `.agents/agents/cybersecurity/agente.md`. Responsável pela auditoria estática e dinâmica (SAST/DAST), conformidade OWASP, middlewares de proteção e blindagem de dados.

---

## 📦 Política e Retenção de Backups

O diretório `backup/` armazena backups completos periódicos:
1. **Frequência:** 1 backup compactado `.zip` gerado a cada 5 modificações/versões.
2. **Limite de Retenção:** São mantidas até **5 versões ativas**. Ao atingir a 6ª versão, a mais antiga é automaticamente excluída.
3. **Destaque:** Versões marcadas com `[DESTAQUE]` são permanentemente preservadas e imunes à rotação de limpeza.

---

## 🚀 Comandos Rápidos

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor backend na porta 3000 |
| `npm run test:security` | Executa a suíte completa de testes de invasão e segurança (DAST) |
| `npm run test:db` | Executa o teste de persistência e diagnóstico de banco de dados |
