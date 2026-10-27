import type { Config } from "@react-router/dev/config";

// SPA puro: nenhum servidor Node em produção. O binário Go serve os arquivos estáticos.
// Sem `prerender` porque todas as telas ficam atrás de login (ver ADR 003).
export default {
  ssr: false,
} satisfies Config;
