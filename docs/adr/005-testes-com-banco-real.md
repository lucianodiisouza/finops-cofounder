# 005 - Testes de API contra o Postgres real

**Status:** Accepted

## Context
Os handlers precisam ser testados. As opções eram simular (mockar) a camada de banco
ou rodar os testes contra um Postgres de verdade.

## Decision
Os testes de handler sobem um `httptest.Server` ligado ao mesmo Postgres local usado
em desenvolvimento. As migrations rodam uma única vez por execução. Cada teste cria o
próprio usuário pelo endpoint de desenvolvimento e o remove no fim; projetos, serviços
e cotações somem junto por `ON DELETE CASCADE`.

As regras de cálculo ficam no pacote `internal/costing`, que é puro e não toca no banco —
é testado isoladamente, sem infraestrutura.

## Rationale
- A maior parte da autorização do FinOps vive nas próprias queries (`WHERE user_id = $1`,
  `EXISTS (SELECT 1 FROM projects ...)`). Um mock da camada de banco não exercitaria
  exatamente a parte que mais importa proteger — por isso existem testes explícitos de
  isolamento entre usuários.
- Restrições do esquema (CHECK de moeda, de ciclo, de datas; UNIQUE de e-mail e de
  cotação) só são verificadas de verdade contra o banco real.
- O Postgres local já é pré-requisito do desenvolvimento, então não há custo extra de setup.

## Trade-offs
**Pros:**
- Cobre o contrato real da API, incluindo autorização e restrições do esquema.
- Sem mocks para manter em sincronia com as queries.

**Cons:**
- Os testes exigem o container do banco em pé e `DATABASE_URL` definida; sem ela, são
  pulados com uma mensagem explicando como rodá-los.
- São mais lentos que testes puros — na prática, menos de um segundo no total.

## Alternatives Considered
- **Mockar a interface de queries**: descartado por não exercitar a autorização nem as
  restrições do esquema, que é justamente o risco a cobrir.
- **Transação com rollback por teste**: descartado porque os handlers usam o pool
  diretamente; passar uma transação exigiria uma camada de indireção só para os testes.
  A limpeza por usuário atinge o mesmo isolamento com menos acoplamento.
