# 004 - Componentes de interface próprios em vez de shadcn/ui

**Status:** Accepted

## Context
O stack padrão sugere shadcn/ui para os componentes de interface. O FinOps, porém,
adota uma direção visual específica — estética de livro-caixa contábil: papel quente,
filetes de 1px, tipografia editorial (Instrument Serif) e números tabulares
(IBM Plex Mono). Os componentes do shadcn trazem uma linguagem visual própria
(raios de borda, sombras, escala tipográfica) que precisaria ser sobrescrita quase
por inteiro.

## Decision
As primitivas de interface (`Button`, `Input`, `Select`, `Field`, `Card`, `Dialog`,
`Badge`, `Notice`, `EmptyState`) são escritas à mão em `app/components/ui.tsx`, com
Tailwind e tokens CSS próprios. Os gráficos são SVG escrito à mão, sem biblioteca.

Todas as cores vêm de variáveis CSS definidas em `app/app.css`; nenhum componente
referencia um valor de cor literal. Os temas claro e escuro são paletas desenhadas
separadamente, não uma inversão automática.

A paleta de séries usada nos gráficos e nas cores de projeto é a paleta categórica
de 8 posições validada para daltonismo: separação ΔE acima do piso entre pares
adjacentes nas simulações de protanopia, deuteranopia e tritanopia, nas duas
superfícies (papel `#f5f1e8` e tinta `#1c1a16`). No tema claro quatro das cores
ficam abaixo de 3:1 de contraste com a superfície, o que obriga rótulo visível —
por isso toda barra tem o nome e o valor escritos ao lado, e a tela de evolução
traz a mesma informação em tabela.

## Rationale
- A direção visual é central ao produto: uma ferramenta de dinheiro ganha confiança
  parecendo um livro-caixa, não um painel genérico.
- Sobrescrever o shadcn quase por completo custaria mais do que escrever as dez
  primitivas de que o app precisa.
- Sem biblioteca de gráficos, o bundle fica menor e o SVG atende exatamente às
  regras de marca adotadas (ponta arredondada de 4px, folga de 2px entre segmentos,
  grade recessiva, legenda a partir de duas séries).

## Escala dos gráficos lado a lado

O painel mostra um gráfico por projeto, lado a lado. Gráficos assim só podem ser
comparados entre si se compartilharem o eixo, e é esse o padrão. Mas com uma escala
comum um projeto que representa 4% do total vira um traço, e a variação dele fica
ilegível — exatamente o que o usuário quer enxergar.

Em vez de escolher um dos lados em silêncio, a tela expõe a alternância entre
*Comparável* e *Própria* e escreve embaixo dos cartões o que cada uma significa.
O padrão é a escala comum, que é a leitura honesta; quem precisa inspecionar um
projeto pequeno troca explicitamente, ciente de que perdeu a comparabilidade.

## Trade-offs
**Pros:**
- Identidade visual coesa e distinta.
- Menos dependências para manter e atualizar.
- Controle total sobre acessibilidade (o `Field` liga dica e erro ao campo por
  `aria-describedby`, em vez de deixá-los entrar no nome acessível).

**Cons:**
- Componentes novos precisam ser escritos do zero em vez de instalados.
- Comportamentos complexos (combobox, menu, popover) teriam de ser implementados
  à mão se vierem a ser necessários; nesse caso vale reconsiderar uma biblioteca
  só de comportamento, como Radix, mantendo o estilo próprio.

## Alternatives Considered
- **shadcn/ui com tema customizado**: descartado porque a customização necessária
  equivale a reescrever os componentes, sem a economia que justificaria a dependência.
- **Biblioteca de gráficos (Recharts, Visx)**: descartada porque os dois gráficos do
  app são simples e as regras de marca adotadas seriam mais fáceis de aplicar
  escrevendo o SVG do que configurando a biblioteca.
