import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuração separada da do Vite: os testes de componente não precisam do
// plugin do React Router, e o Vitest transforma JSX nativamente.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
