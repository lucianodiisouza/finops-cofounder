import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/login";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Button, Field, Input, Notice } from "~/components/ui";
import { api } from "~/lib/api";

export const meta: Route.MetaFunction = () => [{ title: "Entrar — FinOps" }];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quem já está autenticado não precisa ver esta tela.
  useEffect(() => {
    api.me().then(
      () => navigate("/", { replace: true }),
      () => undefined,
    );
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register(email, password);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Lado editorial: o que a ferramenta faz, em uma frase grande. */}
      <section className="relative hidden flex-col justify-between border-r border-rule bg-surface px-12 py-12 lg:flex">
        <p className="font-display text-3xl leading-none text-ink">FinOps</p>

        <div className="enter max-w-lg">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-3">
            livro-caixa de projetos
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink">
            Quanto <em className="text-accent">cada projeto</em> seu custa por mês.
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-ink-2">
            Cadastre servidor, banco, domínio e APIs com valor e moeda. O FinOps converte
            tudo para reais, mostra o total do mês e a evolução mês a mês.
          </p>
        </div>

        {/* Mini livro-caixa decorativo: filetes e números tabulares. */}
        <dl className="flex flex-col gap-2 border-t border-rule pt-5 text-sm">
          {[
            ["Loja Online", "R$ 158,18"],
            ["App de Receitas", "R$ 395,66"],
            ["Blog Pessoal", "R$ 24,90"],
          ].map(([name, value]) => (
            <div key={name} className="flex items-baseline justify-between gap-6">
              <dt className="text-ink-3">{name}</dt>
              <dd className="tnum text-ink-2">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="enter mx-auto w-full max-w-sm">
          <p className="font-display text-3xl leading-none text-ink lg:hidden">FinOps</p>
          <h2 className="mt-6 font-display text-4xl leading-none text-ink lg:mt-0">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {mode === "login"
              ? "Acesse o livro-caixa dos seus projetos."
              : "Comece cadastrando seu e-mail e uma senha."}
          </p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <Field label="E-mail">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </Field>
            <Field
              label="Senha"
              hint={mode === "register" ? "Ao menos 8 caracteres." : undefined}
            >
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && <Notice>{error}</Notice>}

            <Button type="submit" disabled={submitting} className="mt-1 w-full py-2.5">
              {submitting ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-2">
            {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="cursor-pointer font-semibold text-accent underline decoration-accent/40 underline-offset-4"
            >
              {mode === "login" ? "Criar uma agora" : "Entrar"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
