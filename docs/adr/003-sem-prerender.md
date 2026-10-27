# 003 - Sem prerender de páginas públicas

**Status:** Accepted

## Context
O stack padrão prerenderiza rotas públicas em HTML estático para que buscadores e agentes de
IA consigam ler o conteúdo. O FinOps, porém, é uma ferramenta pessoal: todas as telas ficam
atrás de login e não há conteúdo público a ser indexado.

## Decision
`react-router.config.ts` usa `ssr: false` sem a lista `prerender`. Não são servidos
`robots.txt`, `sitemap.xml` ou `llms.txt`.

## Rationale
- Não existe página pública: prerender não traria nenhum benefício de SEO.
- Build mais simples e rápido.
- O shell do SPA é emitido como `index.html`, que é o caminho que o handler Go espera.

## Trade-offs
**Pros:**
- Menos configuração e menos superfície para erro.
- Build mais rápido.

**Cons:**
- Se no futuro houver uma landing page pública, será preciso adicionar a lista `prerender`
  e revisar o handler de arquivos estáticos (que detecta `__spa-fallback.html`
  automaticamente, então a mudança é pequena).

## Alternatives Considered
- Prerenderizar a tela de login: descartado — uma tela de login não tem valor de indexação.
