import { NavLink, useNavigate } from "react-router";
import { api } from "~/lib/api";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { to: "/", label: "Painel" },
  { to: "/evolucao", label: "Evolução" },
  { to: "/cotacoes", label: "Cotações" },
];

/** Moldura das telas autenticadas: cabeçalho, navegação e rodapé. */
export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  const logout = async () => {
    await api.logout().catch(() => undefined);
    navigate("/entrar", { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 sm:px-8">
          <NavLink to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl leading-none tracking-tight text-ink">
              FinOps
            </span>
            <span className="hidden text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3 sm:inline">
              livro-caixa de projetos
            </span>
          </NavLink>

          <nav className="order-3 -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  "cursor-pointer rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (isActive
                    ? "bg-surface-2 text-ink"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-xs text-ink-3 md:inline">{email}</span>
            <button
              type="button"
              onClick={logout}
              className="cursor-pointer text-xs font-semibold text-ink-3 underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </div>
  );
}
