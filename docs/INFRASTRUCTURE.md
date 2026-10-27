# FinOps — Inventário de Serviços

**Última atualização:** 2026-10-26

Serviços dos quais a aplicação depende além do binário Go.

| Nome | Imagem | Porta local | Variável de ambiente | Tipo |
|------|--------|-------------|----------------------|------|
| db | supabase/postgres:17.11.0.007 | 5433 | DATABASE_URL | backend |

**Observações**

- A porta local é 5433 (e não a 5432 padrão) porque já existe outro projeto nesta
  máquina usando a 5432. O valor real é sempre o que está em `DATABASE_URL`, no `.env`.
- O container local chama-se `finops-cofounder-db`.
- Nenhuma extensão do Postgres além de `pgcrypto` (para `gen_random_uuid()`) é usada.
  Não há fila, cache nem busca: o volume de dados de uma ferramenta pessoal não justifica.
- No ambiente publicado o host passa a ser `db:5432`, pelo DNS interno da nuvem.

## Ambientes publicados

| Ambiente | Gatilho | Zona | VM da web | VM do banco | Endereço |
|----------|---------|------|-----------|-------------|----------|
| preview | push na `main` | ZP01 | `small` (1 vCPU / 2 GiB), disco 20 GB | `small` (1 vCPU / 2 GiB), disco 10 GB | `https://<ip>.nip.io` |

- Configuração em `config/deploy.yml` (comum) e `config/deploy.preview.yml` (ambiente).
- Publicação por `.github/workflows/deploy-preview.yml`; para desfazer o ambiente,
  `.github/workflows/teardown-preview.yml` (execução manual).
- O disco de dados fica montado em `/data/` nas duas VMs, com snapshot diário
  automático. O Postgres grava em `/data/pgdata`.
- HTTPS com certificado Let's Encrypt emitido automaticamente.

## Variáveis de ambiente

| Variável | Local | Publicado | Observação |
|----------|-------|-----------|------------|
| `DATABASE_URL` | `.env` | derivada de `POSTGRES_PASSWORD` em `.kamal/secrets.preview` | Obrigatória: o servidor não sobe sem ela |
| `PORT` | `.env` (8080) | `ENV PORT=80` no Dockerfile | Não precisa de secret |
| `BASE_URL` | `.env` | `env.clear` no config do ambiente | Reservada para quando houver login por e-mail ou domínio próprio |
| `DEV_MODE` | ligada no desenvolvimento | **nunca** definida | É o que mantém `POST /api/dev/login` fora do ar em produção |
| `POSTGRES_PASSWORD` | — | GitHub Secret | Gerada aleatoriamente; nunca aparece em texto no repositório |

**Segredos no GitHub:** `CLOUDSTACK_API_KEY`, `CLOUDSTACK_SECRET_KEY`, `SSH_PRIVATE_KEY`,
`POSTGRES_PASSWORD`. A chave SSH privada correspondente fica em `~/.ssh/finops-cofounder`
na máquina de desenvolvimento — se ela se perder, use a skill de rotação de chaves.
