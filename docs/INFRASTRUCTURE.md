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
- No ambiente publicado o host passa a ser `db:5432`, fornecido pela configuração de deploy.
