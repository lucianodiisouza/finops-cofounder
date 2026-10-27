# FinOps — Tarefas de Desenvolvimento

**Última atualização:** 2026-10-26

## Fase 1 — Fundação

| Tarefa | Status | Notas |
|--------|--------|-------|
| Criar repositório Git local e remoto no GitHub | Done | `lucianodiisouza/finops-cofounder` (privado) |
| Configurar `mise.toml` com versões das ferramentas | Done | Go 1, Node 24, sqlc 1, Python 3.14, jq 1 |
| Subir Postgres local via podman | Done | Container `finops-cofounder-db`, porta 5433 |
| Escrever PRD | Done | `docs/PRD.md` |
| Escrever ADRs iniciais | Done | 001 a 003 |
| Scaffold do backend Go (config, db, migrations, handlers) | Done | |
| Scaffold do frontend React (React Router, Tailwind, shadcn) | Done | SPA, sem prerender (app atrás de login) |
| Dockerfile multi-stage | Done | |

## Fase 2 — Modelo de Dados e API

| Tarefa | Status | Notas |
|--------|--------|-------|
| Migrations: users, sessions, projects, services, exchange_rates | Done | `001_initial.sql` |
| Queries sqlc + geração de código | Done | |
| Autenticação: cadastro, login, logout, sessão por cookie | Done | bcrypt + cookie HttpOnly |
| Endpoint dev-only `POST /api/dev/login` | Done | Só com `DEV_MODE=1` |
| CRUD de projetos | Done | |
| CRUD de serviços | Done | |
| CRUD de cotações de moeda | Done | |
| Cálculo do custo mensal (conversão + rateio anual) | Done | `internal/costing` |
| Endpoint do painel do mês | Done | `GET /api/dashboard?month=YYYY-MM` |
| Endpoint de evolução 12 meses | Done | `GET /api/evolution` |
| Endpoint de detalhe do projeto | Done | `GET /api/projects/{id}/summary?month=YYYY-MM` |
| Health check `GET /up` | Done | |

## Fase 3 — Interface

| Tarefa | Status | Notas |
|--------|--------|-------|
| Tela de login / cadastro | Done | |
| Painel do mês (total, variação, cartão por projeto) | Done | Um cartão por projeto com custo, variação própria e gráfico de 12 meses |
| Alternância de escala dos gráficos do painel | Done | Comparável (padrão) ou própria de cada projeto |
| Tela de projeto (serviços, categorias, gráfico) | Done | |
| Tela de evolução mês a mês | Done | |
| Tela de cotações de moeda | Done | |
| Formulários de projeto e serviço | Done | |
| Formatação BRL e datas pt-BR | Done | |
| Layout responsivo (celular e desktop) | Done | |

## Fase 4 — Qualidade

| Tarefa | Status | Notas |
|--------|--------|-------|
| Testes Go: cálculo de custos | Done | `internal/costing` — conversão, rateio anual, vigência |
| Testes Go: handlers da API | Done | Inclui isolamento entre usuários em projetos, serviços e cotações |
| Testes Go: autenticação e configuração | Done | Hash de senha, cookie, variáveis de ambiente |
| Testes Vitest: componentes e formatação | Done | 88 testes em 10 arquivos |
| Testes Vitest: painel do mês | Done | Cartões por projeto, variação própria, alternância de escala |
| Typecheck do frontend | Done | `npm run typecheck` |
| Verificação visual (screenshots Playwright) | Done | `e2e/screenshots.mjs` — 4 telas × 2 temas × desktop e celular |
| Guarda automática contra rolagem horizontal | Done | Falha a captura se a página vazar da tela |
| Validação do modo de produção (binário único) | Done | Tipos MIME dos assets, rotas do SPA, `/api/dev/login` ausente |

## Correções encontradas pelos testes

| Problema | Encontrado por | Situação |
|----------|----------------|----------|
| `parseDecimal` tratava o ponto como separador de milhar: digitar a cotação "5.42" virava 542 | Teste de unidade | Corrigido |
| A dica do campo entrava no nome acessível do input ("Valor Use vírgula…" em vez de "Valor") | Teste de componente | Corrigido — dica e erro agora ligados por `aria-describedby` |
| No celular a página rolava na horizontal: cartões dentro de grid não encolhiam | Verificação visual | Corrigido com `min-w-0` no `Card`; há guarda automática |
| Eixo do gráfico caía em valores quebrados (R$ 188, R$ 563) | Verificação visual | Corrigido com `niceScale`, coberto por teste |
| O seletor de tema piscava em "sistema" antes de ler a preferência salva | Verificação visual | Corrigido com inicialização preguiçosa do estado |

## Próximos Passos (backlog)

| Tarefa | Status | Notas |
|--------|--------|-------|
| Deploy no Locaweb Cloud (ambiente de Preview) | In Progress | Workflows e config do Kamal criados; primeira publicação em andamento |
| Ambiente de produção com domínio próprio | Pending | Quando o Preview estiver validado |
| Cotação automática via API externa | Pending | Fora do escopo da v1 |
| Exportação CSV | Pending | Fora do escopo da v1 |
| Alertas de limite de custo por e-mail | Pending | Fora do escopo da v1 |
| Login com Google ou link mágico (substituir senha) | Pending | Recomendado antes de uso em produção |
