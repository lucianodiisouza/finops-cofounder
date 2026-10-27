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
| preview | push na `main` ou disparo manual | ZP01 | `small` (1 vCPU / 2 GiB), disco 20 GB | `small` (1 vCPU / 2 GiB), disco 10 GB | https://191.252.228.197.nip.io |

- Configuração em `config/deploy.yml` (comum) e `config/deploy.preview.yml` (ambiente).
- Publicação por `.github/workflows/deploy-preview.yml`; para desfazer o ambiente,
  `.github/workflows/teardown-preview.yml` (execução manual).
- O disco de dados fica montado em `/data/` nas duas VMs, com snapshot diário
  automático. O Postgres grava em `/data/pgdata`.
- HTTPS com certificado Let's Encrypt emitido automaticamente.
- IPs: web `191.252.228.197` (interno `10.1.1.97`), banco `191.252.228.202`.
  O IP é estável entre publicações; só muda se o ambiente for desfeito e recriado.
- Acesso por SSH para diagnóstico: `ssh -i ~/.ssh/finops-cofounder root@191.252.228.197`
  (sempre com `-i`, nunca a chave padrão).

### Histórico de incidentes

- **2026-10-26 — primeira publicação falhou duas vezes.** A primeira tentativa nem
  iniciou: o GitHub Actions estava bloqueado por faturamento da conta (repositório
  era privado, e minutos de automação são pagos nesse caso). O repositório foi
  tornado público, o que libera minutos gratuitos. A segunda tentativa falhou com
  `The vm with hostName web already exists`: a API da nuvem criou a VM mas falhou ao
  responder (`failed to decode response`), e a repetição automática esbarrou na VM
  que já existia. Solução: `teardown-preview` e nova publicação, que funcionou.
  Se o erro "already exists" voltar, é o mesmo caso — desfazer e republicar.

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
