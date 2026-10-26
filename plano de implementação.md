# PLANO COMPLETO DE IMPLEMENTAÇÃO — LUMUZIA EDUCAÇÃO FINANCEIRA

## Visão geral

A proposta é criar dentro da LumuzIA uma área própria de educação financeira gamificada, com identidade visual da Lumuz e progressão baseada em tarefas.

A ideia central é transformar educação financeira em uma experiência recorrente, onde o usuário aprende um pouco por dia e acompanha seu avanço.

A experiência terá:

- trilha de aprendizado;
- módulos;
- tasks;
- perguntas;
- feedback educativo;
- XP;
- níveis;
- ofensiva diária;
- cifrão `$` como símbolo da ofensiva;
- progressão de cor do verde claro ao roxo;
- estatísticas;
- conclusão de módulos;
- certificado final;
- nome real do usuário;
- PDF de certificado;
- integração com o perfil e autenticação existentes.

---

# PRINCÍPIO PRINCIPAL

O projeto deve ser implementado em etapas.

Não construir tudo ao mesmo tempo.

A ordem recomendada é:

```text
Visual
↓
Tasks
↓
Conteúdo
↓
Persistência
↓
Ofensiva
↓
XP
↓
Níveis
↓
Certificado
↓
Polimento
```

---

# FASE 0 — ANÁLISE E PREPARAÇÃO

Antes de implementar novas funcionalidades:

## Analisar

- estrutura atual do frontend;
- autenticação Firebase;
- `auth-guard.js`;
- `apiClient.js`;
- `sidebar.js`;
- banco de dados;
- `database.js`;
- `server.js`;
- perfil;
- forma como `req.uid` é utilizado;
- forma como migrations/tabelas são criadas;
- sistema de segurança atual.

## Não fazer nesta fase

- refatoração geral;
- troca de framework;
- migração para React;
- alteração da autenticação;
- alteração de regras de segurança.

---

# FASE 1 — PROTÓTIPO VISUAL

## Objetivo

Criar a primeira versão visual completamente funcional no frontend usando dados mockados.

## Arquivos

Criar:

```text
frontend/educacao.html
frontend/css/educacao.css
frontend/js/educacao.js
```

Adicionar acesso na sidebar:

```text
Educação Financeira
```

---

# TELA PRINCIPAL

## Cabeçalho

Título:

```text
LumuzIA Educação Financeira
```

Subtítulo:

```text
Aprenda a cuidar melhor do seu dinheiro, um passo por vez.
```

---

# CARD DE OFENSIVA

Mostrar:

```text
$
12 dias de ofensiva

Maior ofensiva
24 dias
```

Texto auxiliar:

```text
Continue aprendendo hoje para manter sua ofensiva.
```

---

# EVOLUÇÃO DO CIFRÃO

O símbolo da ofensiva deve ser:

```text
$
```

Não utilizar fogo.

Progressão sugerida:

```text
1 dia
verde claro

7 dias
verde

14 dias
verde escuro

30 dias
verde azulado

60 dias
azul

100 dias+
roxo
```

## Cores aproximadas

```text
#6FE7A0
#42C989
#159B79
#147D8C
#326CA8
#654CB4
#8B4AC6
```

Preferencialmente interpolar as cores em vez de usar apenas faixas fixas.

---

# EFEITOS VISUAIS

## 1 a 6 dias

Cifrão simples.

## 7 a 29 dias

Leve brilho.

## 30 a 59 dias

Brilho mais intenso.

## 60 a 99 dias

Pulso discreto.

## 100+

Efeito roxo especial.

Evitar exageros.

---

# CARD DE PROGRESSO

Mostrar:

```text
Progresso geral
32%

Tasks
8 / 25

XP
320 XP

Módulo atual
Reserva de Emergência
```

---

# TRILHA

Criar uma trilha visual.

Exemplo:

```text
Fundamentos Financeiros
        ↓
Receitas e Despesas
        ↓
Orçamento
        ↓
Reserva de Emergência
        ↓
Dívidas e Juros
        ↓
Metas
        ↓
Renda Fixa
        ↓
Investimentos
        ↓
Diversificação
        ↓
Conclusão
```

---

# ESTADOS VISUAIS

Cada task pode estar:

```text
bloqueada
disponível
em andamento
concluída
```

Visualmente:

```text
✓ concluída
● atual
○ disponível
🔒 bloqueada
```

No produto final, usar ícones SVG/CSS em vez de emoji.

---

# FASE 2 — SISTEMA DE TASKS

## Objetivo

Criar a interação real da aula.

Cada task pode ter:

- título;
- texto curto;
- exemplo;
- pergunta;
- alternativas;
- explicação;
- botão continuar.

---

# TIPOS DE QUESTÃO

Inicialmente implementar:

## Múltipla escolha

Exemplo:

```text
Qual opção é mais adequada para uma reserva de emergência?

Ações
Criptomoedas
Tesouro Selic
FII
```

## Verdadeiro ou falso

```text
Uma reserva de emergência deve ficar em um investimento de baixa liquidez.

Verdadeiro
Falso
```

## Situação prática

```text
Você recebe R$ 3.000 e gasta R$ 2.600.

Quanto sobra?

R$ 200
R$ 300
R$ 400
R$ 500
```

---

# FEEDBACK

## Correto

```text
Correto!

Uma reserva de emergência precisa de liquidez e baixo risco.
```

## Errado

Não mostrar apenas:

```text
Errado.
```

Mostrar explicação.

Exemplo:

```text
Essa alternativa não é a mais adequada.

Ações podem sofrer variações fortes no curto prazo, então não são ideais para uma reserva de emergência.
```

Permitir nova tentativa.

---

# NÃO IMPLEMENTAR VIDAS

Não criar:

- corações;
- punição;
- espera;
- bloqueio por erro.

A proposta é educativa.

---

# FASE 3 — ESTRUTURA DE CONTEÚDO

Criar um arquivo separado.

Exemplo:

```text
frontend/js/education-content.js
```

Estrutura:

```js
{
  id: "reserva-001",
  moduleId: "reserva-emergencia",
  title: "Onde guardar sua reserva?",
  type: "multiple-choice",
  content: "...",
  question: "...",
  answers: [
    "Ações",
    "Criptomoedas",
    "Tesouro Selic",
    "Fundos Imobiliários"
  ],
  correctAnswer: 2,
  explanation: "...",
  xp: 10
}
```

---

# ESTRUTURA DE MÓDULO

```js
{
  id: "reserva-emergencia",
  title: "Reserva de Emergência",
  description: "...",
  order: 4,
  tasks: [
    "reserva-001",
    "reserva-002",
    "reserva-003"
  ]
}
```

---

# FASE 4 — CONTEÚDO INICIAL

Começar com 3 módulos.

## Módulo 1 — Fundamentos Financeiros

Tasks:

- O que é educação financeira;
- receitas e despesas;
- saldo;
- patrimônio;
- quiz.

---

## Módulo 2 — Orçamento

Tasks:

- orçamento mensal;
- gastos fixos;
- gastos variáveis;
- gastos supérfluos;
- planejamento;
- quiz.

---

## Módulo 3 — Reserva de Emergência

Tasks:

- conceito;
- objetivo;
- quanto guardar;
- onde guardar;
- quando usar;
- quiz.

---

# FASE 5 — EXPANSÃO DA TRILHA

Depois validar os primeiros módulos.

Adicionar:

## Módulo 4

Dívidas e Juros

## Módulo 5

Metas Financeiras

## Módulo 6

Renda Fixa

## Módulo 7

Ações

## Módulo 8

Fundos Imobiliários

## Módulo 9

Criptomoedas

## Módulo 10

Diversificação e Planejamento

---

# FASE 6 — PERSISTÊNCIA REAL

## Objetivo

Salvar progresso por usuário.

Utilizar:

```text
req.uid
```

Nunca confiar em UID enviado pelo navegador.

---

# TABELA education_progress

Sugestão:

```sql
education_progress
```

Campos:

```text
id
user_id
module_id
task_id
status
attempts
completed_at
xp_earned
created_at
updated_at
```

---

# STATUS

Valores possíveis:

```text
available
in_progress
completed
```

Bloqueio pode ser calculado pelo sistema, não necessariamente salvo.

---

# FASE 7 — API

Criar endpoints.

## Buscar trilha

```text
GET /api/educacao/trilha
```

Retorna:

- módulos;
- tasks;
- progresso;
- locks.

---

## Buscar progresso

```text
GET /api/educacao/progresso
```

Retorna:

```json
{
  "xp": 320,
  "completedTasks": 8,
  "totalTasks": 25,
  "currentStreak": 12,
  "bestStreak": 24
}
```

---

## Buscar task

```text
GET /api/educacao/task/:id
```

---

## Responder

```text
POST /api/educacao/task/:id/responder
```

Body:

```json
{
  "answer": 2
}
```

O backend deve validar.

---

## Concluir

```text
POST /api/educacao/task/:id/concluir
```

O backend decide:

- se pode concluir;
- XP;
- progresso;
- ofensiva.

---

# FASE 8 — OFENSIVA

Criar tabela:

```text
education_streak
```

Campos:

```text
user_id
current_streak
best_streak
last_activity_date
updated_at
```

---

# REGRAS

A ofensiva aumenta apenas uma vez por dia.

Exemplo:

```text
segunda
5 tasks
+1 dia

terça
2 tasks
+1 dia

quarta
0 tasks
ofensiva quebra
```

---

# REGRAS DE CONTINUIDADE

Se:

```text
last_activity_date = ontem
```

então:

```text
current_streak += 1
```

Se:

```text
last_activity_date = hoje
```

não aumentar.

Se for anterior a ontem:

```text
current_streak = 1
```

---

# TIMEZONE

Trabalhar com data calendário.

Evitar:

```text
Date.now() - lastActivity
```

como regra única.

Preferir:

```text
YYYY-MM-DD
```

---

# FASE 9 — XP

Sugestão:

```text
Task
10 XP

Quiz
20 XP

Fim de módulo
50 XP

Trilha completa
200 XP
```

XP sempre calculado no backend.

---

# PREVENÇÃO DE EXPLOIT

Uma task só concede XP uma vez.

Revisar uma task:

```text
0 XP adicional
```

---

# FASE 10 — NÍVEIS

Criar níveis com XP acumulado.

Sugestão:

```text
0 XP
Iniciante Financeiro

100 XP
Organizador

300 XP
Planejador

700 XP
Investidor Iniciante

1200 XP
Investidor Consciente

2000 XP
Estrategista Financeiro

3500 XP
Mestre Lumuz
```

---

# FASE 11 — CONQUISTAS

Opcional.

Exemplo:

```text
Primeiro Passo
Concluiu a primeira task

Semana Perfeita
7 dias de ofensiva

Consistência Financeira
30 dias

Mestre da Reserva
Concluiu o módulo de reserva

Investidor Consciente
Concluiu investimentos
```

---

# FASE 12 — DASHBOARD EDUCACIONAL

Criar uma área com:

```text
XP
nível
ofensiva
melhor ofensiva
tasks concluídas
progresso
módulo atual
próxima task
```

Exemplo:

```text
Nível 3
Planejador

840 XP

Ofensiva
$ 17 dias

Progresso
42%
```

---

# FASE 13 — CERTIFICADO

Liberar apenas quando todos os módulos obrigatórios forem concluídos.

---

# TABELA DE CERTIFICADOS

Criar:

```text
education_certificates
```

Campos:

```text
id
user_id
certificate_code
completed_at
issued_at
```

---

# NOME DO CERTIFICADO

```text
LumuzIA Educação Financeira
```

---

# TEXTO

```text
LumuzIA

Certificado de Conclusão

Certificamos que

[NOME DO USUÁRIO]

concluiu com sucesso a trilha

LumuzIA Educação Financeira

demonstrando conhecimento nos fundamentos de organização financeira, orçamento, planejamento e investimentos.
```

---

# NOME DO USUÁRIO

Prioridade:

```text
perfil LumuzIA
↓
Firebase displayName
↓
solicitar atualização do perfil
```

---

# CÓDIGO ÚNICO

Exemplo:

```text
LUMUZ-EF-A8F92C3D
```

Nunca gerar somente no frontend.

---

# FASE 14 — PDF

Gerar PDF real.

Sugestão:

- jsPDF;
- PDFKit no backend;
- outra biblioteca confiável.

O PDF deve conter:

- logo;
- nome;
- trilha;
- data;
- código;
- design Lumuz.

---

# FASE 15 — VERIFICAÇÃO DE CERTIFICADO

Opcionalmente criar:

```text
/certificado/LUMUZ-EF-A8F92C3D
```

ou endpoint:

```text
GET /api/educacao/certificado/:codigo
```

Retorna:

```text
válido
nome
data
curso
```

Sem expor dados financeiros.

---

# FASE 16 — TELA DE CONCLUSÃO

Ao terminar:

```text
Parabéns!

Você concluiu a LumuzIA Educação Financeira.
```

Mostrar:

```text
Tasks
40

XP
1800

Ofensiva
34 dias

Melhor ofensiva
42 dias
```

Botão:

```text
Gerar certificado
```

---

# FASE 17 — MICROINTERAÇÕES

Adicionar:

- animação ao ganhar XP;
- brilho no cifrão;
- transição ao desbloquear task;
- progresso animado;
- pequena comemoração de módulo.

---

# CONFETE

Somente em:

- conclusão de módulo;
- conclusão total.

Respeitar:

```css
prefers-reduced-motion
```

---

# FASE 18 — ESTADOS DE INTERFACE

Criar estados para:

```text
carregando
erro
sem conexão
sem progresso
task bloqueada
task concluída
módulo concluído
```

---

# FASE 19 — MOBILE

Garantir:

- trilha vertical;
- cards responsivos;
- task fullscreen;
- botões grandes;
- alternativas fáceis de tocar;
- sidebar adaptada.

---

# FASE 20 — ACESSIBILIDADE

Implementar:

- navegação por teclado;
- foco visível;
- `aria-label`;
- contraste suficiente;
- feedback por texto e ícone;
- não depender apenas de cor;
- `prefers-reduced-motion`.

---

# FASE 21 — SEGURANÇA

Toda rota deve manter:

- autenticação;
- rate limiting;
- validação;
- `req.uid`;
- consultas parametrizadas.

Nunca confiar no frontend para:

```text
XP
ofensiva
status
certificado
task concluída
```

---

# FASE 22 — TESTES

Criar testes para:

## Progressão

- task anterior obrigatória;
- task bloqueada;
- task concluída;
- repetição.

## XP

- primeira conclusão concede XP;
- repetição não concede.

## Ofensiva

- primeira atividade;
- mesma data;
- dia seguinte;
- vários dias sem atividade;
- timezone.

## Certificado

- não concluído;
- concluído;
- código único;
- nome correto.

---

# FASE 23 — TESTES DE FRONTEND

Testar:

- resposta certa;
- resposta errada;
- desbloqueio;
- progresso;
- mobile;
- reload;
- usuário sem progresso.

---

# FASE 24 — INTEGRAÇÃO COM A LUMUZ

Depois do sistema estar estável, integrar educação com dados financeiros.

Exemplo:

Se usuário não possui reserva:

```text
Recomendação:
Faça o módulo Reserva de Emergência.
```

Se possui muitas parcelas:

```text
Recomendação:
Revise Dívidas e Juros.
```

Se não possui meta:

```text
Recomendação:
Faça o módulo Metas Financeiras.
```

---

# FASE 25 — IA COMO TUTOR

Futuramente, a LumuzIA pode explicar questões.

Exemplo:

```text
Não entendi essa resposta.
```

A IA recebe:

- pergunta;
- alternativa marcada;
- explicação oficial.

E explica em linguagem simples.

A IA não decide a resposta correta.

A resposta correta deve vir do conteúdo estruturado.

---

# FASE 26 — CONTEÚDO ADAPTATIVO

Futuro.

Se usuário errar várias questões de juros:

```text
recomendar revisão de juros
```

Se dominar um módulo:

```text
avançar mais rápido
```

---

# FASE 27 — DESAFIOS DIÁRIOS

Futuro.

Exemplo:

```text
Desafio do dia

Você tem R$ 500 livres.
Qual seria a melhor decisão?
```

Concede XP pequeno.

Não deve ser obrigatório para manter a ofensiva inicialmente, a menos que isso seja decidido depois.

---

# FASE 28 — RANKING

Não implementar inicialmente.

Se um dia for criado:

- apenas opt-in;
- sem mostrar dados financeiros;
- ranking por XP;
- nickname.

---

# FASE 29 — ADMINISTRAÇÃO DE CONTEÚDO

Futuramente, criar painel para:

- cadastrar módulo;
- cadastrar task;
- editar perguntas;
- editar explicações;
- publicar/despublicar.

---

# FASE 30 — MÉTRICAS

Coletar apenas métricas necessárias.

Exemplo:

```text
módulo mais iniciado
módulo mais abandonado
taxa de conclusão
questão com mais erro
```

Sem expor dados financeiros.

---

# ORDEM RECOMENDADA REAL

## Etapa A

Visual.

## Etapa B

Tasks mockadas.

## Etapa C

Conteúdo estruturado.

## Etapa D

Backend de progresso.

## Etapa E

XP.

## Etapa F

Ofensiva.

## Etapa G

Conteúdo completo.

## Etapa H

Certificado.

## Etapa I

Polimento.

## Etapa J

IA e personalização.

---

# ARQUITETURA RECOMENDADA

## Frontend

```text
frontend/
    educacao.html

frontend/css/
    educacao.css

frontend/js/
    educacao.js
    education-content.js
    education-api.js
    education-ui.js
```

---

## Backend

Sem refatorar todo o projeto.

Sugestão:

```text
backend/
    education/
        education-service.js
        education-routes.js
        streak-service.js
        certificate-service.js
```

Integrar ao `server.js`.

---

# REGRA IMPORTANTE

Não aumentar ainda mais o `server.js` com centenas de linhas de educação financeira.

Criar módulo isolado e importar.

---

# EXEMPLO

```js
const educationRoutes = require("./education/education-routes");
app.use("/api/educacao", educationRoutes);
```

---

# CHECKPOINT 1

Entregar:

- página;
- trilha;
- ofensiva visual;
- XP visual;
- task mockada;
- pergunta;
- feedback.

---

# CHECKPOINT 2

Entregar:

- módulos estruturados;
- navegação;
- desbloqueio mockado;
- conteúdo.

---

# CHECKPOINT 3

Entregar:

- banco;
- API;
- progresso real.

---

# CHECKPOINT 4

Entregar:

- XP;
- ofensiva;
- níveis.

---

# CHECKPOINT 5

Entregar:

- certificado;
- PDF;
- conclusão.

---

# CHECKPOINT 6

Entregar:

- mobile;
- acessibilidade;
- testes;
- polimento.

---

# OBJETIVO FINAL

A LumuzIA Educação Financeira deve funcionar como uma experiência de aprendizado recorrente.

O usuário entra e vê:

```text
$
18 dias de ofensiva
```

Depois:

```text
Continue sua jornada
Reserva de Emergência
```

Conclui a task:

```text
+10 XP

Ofensiva mantida!
```

Continua por semanas.

O cifrão evolui:

```text
verde claro
↓
verde
↓
verde escuro
↓
azul
↓
roxo
```

E, ao terminar:

```text
Parabéns!

Você concluiu a LumuzIA Educação Financeira.
```

Com a opção:

```text
Gerar meu certificado
```

O certificado é emitido com o nome real do usuário e identidade visual da LumuzIA.