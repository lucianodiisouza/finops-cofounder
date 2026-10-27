import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

// Favicon: duas colunas de um livro-caixa sobre papel, no verde contábil.
const favicon =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>" +
  "<rect width='16' height='16' rx='3' fill='%231f6f4a'/>" +
  "<rect x='3' y='9' width='3' height='4' fill='%23f5f1e8'/>" +
  "<rect x='6.5' y='6' width='3' height='7' fill='%23f5f1e8'/>" +
  "<rect x='10' y='3' width='3' height='10' fill='%23f5f1e8'/>" +
  "</svg>";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: favicon },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&" +
      "family=Hanken+Grotesk:wght@400;500;600;700&" +
      "family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  },
];

export const meta: Route.MetaFunction = () => [
  { title: "FinOps — custos dos seus projetos" },
  {
    name: "description",
    content:
      "Cadastre os serviços que você paga em cada projeto e acompanhe o custo mensal em reais, mês a mês.",
  },
];

// Define o tema antes da primeira pintura, evitando o flash de tema errado.
// O atributo data-theme pertence a este script, nunca ao React.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("finops-theme");
    var mode = stored || "system";
    var dark = mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}
})();
`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Algo deu errado";
  let details = "Ocorreu um erro inesperado. Tente recarregar a página.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Página não encontrada" : `Erro ${error.status}`;
    details =
      error.status === 404
        ? "O endereço que você acessou não existe."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">FinOps</p>
      <h1 className="font-display text-5xl leading-[0.95] text-ink">{title}</h1>
      <p className="text-ink-2">{details}</p>
      <a
        href="/"
        className="w-fit cursor-pointer border-b border-accent pb-0.5 text-sm font-semibold text-accent"
      >
        Voltar ao painel
      </a>
      {stack && (
        <pre className="mt-4 overflow-x-auto rounded border border-rule bg-surface p-4 text-xs text-ink-2">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
