# 002 - Cotação de câmbio cadastrada manualmente por mês

**Status:** Accepted

## Context
Serviços são pagos em moedas diferentes (BRL, USD, EUR). O painel precisa de um total único
em BRL. Isso exige uma taxa de conversão. As opções eram buscar a cotação de uma API externa
em tempo real ou deixar o usuário cadastrá-la.

## Decision
O usuário cadastra a cotação de cada moeda estrangeira por mês de competência
(ex.: Out/2026 → 1 USD = 5,40 BRL). O cálculo de um mês usa a cotação daquele mês; se não
existir, usa a cotação mais recente de um mês anterior. Se não houver nenhuma, o serviço é
marcado como "cotação pendente", fica fora do total e gera um aviso na interface.

## Rationale
- O custo real do usuário é o que o cartão cobrou naquele mês, não a cotação de hoje —
  uma cotação fixa por mês de competência reflete melhor a realidade histórica.
- Mantém o histórico estável: um total de março não muda porque o dólar subiu em outubro.
- Sem dependência de serviço de terceiros, chave de API ou indisponibilidade externa.

## Trade-offs
**Pros:**
- Histórico imutável e auditável.
- Zero dependências externas e zero custo.

**Cons:**
- Exige uma ação manual do usuário por mês (cadastrar a cotação).
- Cotação pode ficar desatualizada se o usuário esquecer; mitigado pelo fallback para o mês
  anterior e pelo aviso na interface.

## Alternatives Considered
- API de câmbio em tempo real (ex.: AwesomeAPI, exchangerate.host): descartada na v1 por
  introduzir dependência externa e por fazer totais históricos mudarem retroativamente.
  Permanece no backlog como melhoria opcional que pré-preencheria a cotação do mês.
- Totais separados por moeda, sem conversão: descartado porque não entrega o número único
  que é o objetivo central do produto.
