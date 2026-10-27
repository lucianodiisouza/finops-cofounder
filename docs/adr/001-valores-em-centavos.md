# 001 - Armazenar valores monetários em centavos (inteiros)

**Status:** Accepted

## Context
O FinOps soma, rateia (valores anuais divididos por 12) e converte valores entre moedas.
Operações com ponto flutuante (`float64`) acumulam erros de arredondamento, que aparecem
como centavos "fantasma" em totais e em comparações mês a mês.

## Decision
Todos os valores monetários são armazenados como inteiros em centavos (`BIGINT` no Postgres,
`int64` em Go). A conversão para a exibição formatada acontece apenas na interface.
As cotações de câmbio seguem a mesma ideia: são armazenadas como inteiros escalados por 10^8
(`rate_e8`, ou seja, 5,40 é guardado como 540000000), e a conversão é calculada em Go com
`math/big` para não haver estouro no produto intermediário, arredondando para o centavo mais
próximo apenas no final.

## Rationale
- Elimina erro de ponto flutuante em somas e conversões.
- Padrão consolidado em sistemas financeiros.
- `int64` em centavos suporta valores muito acima de qualquer necessidade realista.

## Trade-offs
**Pros:**
- Totais exatos e reproduzíveis.
- Comparações entre meses confiáveis.

**Cons:**
- Exige conversão explícita (divisão por 100) na camada de apresentação.
- Rateio de valores anuais nem sempre divide exatamente por 12; o arredondamento é aplicado
  por serviço e documentado.

## Alternatives Considered
- `float64` / `DOUBLE PRECISION`: descartado por erro de arredondamento.
- `NUMERIC` no banco com `pgtype.Numeric` em Go: descartado porque o cálculo do painel acontece
  em Go (para ser testável sem banco), e `pgtype.Numeric` torna essa aritmética verbosa sem
  ganho de precisão sobre inteiros escalados.
