import { useCallback, useEffect, useState } from "react";
import type { Route } from "./+types/evolution";
import { EvolutionChart, EvolutionTable } from "~/components/charts";
import { MonthPicker } from "~/components/MonthPicker";
import { Shell } from "~/components/Shell";
import { Card, EmptyState, Notice } from "~/components/ui";
import { api, type EvolutionPoint } from "~/lib/api";
import { currentMonth, formatBRL, formatMonthShort } from "~/lib/format";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";
import { LoadingScreen } from "./dashboard";

export const meta: Route.MetaFunction = () => [{ title: "Evolução mês a mês — FinOps" }];

const windowOptions = [6, 12, 24];

export default function EvolutionPage() {
  const { user, loading } = useSession();
  const { isDark } = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [months, setMonths] = useState(12);
  const [points, setPoints] = useState<EvolutionPoint[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const data = await api.evolution(month, months);
      setPoints(data.months);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a evolução.");
    }
  }, [month, months]);

  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  if (loading || !user) return <LoadingScreen />;

  const hasData = points?.some((point) => point.total_cents > 0) ?? false;
  const average = points?.length
    ? Math.round(points.reduce((sum, p) => sum + p.total_cents, 0) / points.length)
    : 0;
  const peak = points?.reduce(
    (best, point) => (point.total_cents > (best?.total_cents ?? -1) ? point : best),
    null as EvolutionPoint | null,
  );

  return (
    <Shell email={user.email}>
      <div className="enter flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-3">
            Evolução
          </p>
          <h1 className="mt-1 font-display text-4xl leading-none text-ink sm:text-5xl">
            Como seus custos mudaram
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          <div
            role="group"
            aria-label="Janela de meses"
            className="flex items-center gap-0.5 rounded-sm border border-rule bg-surface p-0.5"
          >
            {windowOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMonths(option)}
                aria-pressed={months === option}
                className={
                  "cursor-pointer rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors " +
                  (months === option
                    ? "bg-ink text-paper"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink")
                }
              >
                {option} meses
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {!points ? (
        <p className="mt-8 text-sm text-ink-3">Carregando…</p>
      ) : !hasData ? (
        <Card className="mt-7">
          <EmptyState
            title="Ainda não há histórico"
            description="Assim que você cadastrar projetos e serviços, o gráfico mostra o custo total de cada mês e quanto cada projeto representa."
          />
        </Card>
      ) : (
        <>
          <dl className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Média do período", value: formatBRL(average) },
              {
                label: "Mês mais caro",
                value: peak ? formatBRL(peak.total_cents) : "—",
                hint: peak ? formatMonthShort(peak.month) : undefined,
              },
              {
                label: "Mês selecionado",
                value: formatBRL(points[points.length - 1]?.total_cents ?? 0),
                hint: formatMonthShort(month),
              },
            ].map((tile) => (
              <Card key={tile.label} className="px-5 py-4">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {tile.label}
                </dt>
                <dd className="tnum mt-1 text-2xl font-semibold text-ink">
                  {tile.value}
                  {tile.hint && (
                    <span className="ml-2 font-sans text-xs font-normal text-ink-3">
                      {tile.hint}
                    </span>
                  )}
                </dd>
              </Card>
            ))}
          </dl>

          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Custo total por mês, empilhado por projeto
            </h2>
            <div className="mt-5">
              <EvolutionChart points={points} isDark={isDark} mode="stacked" />
            </div>
          </Card>

          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Mês a mês em números
            </h2>
            <div className="mt-4">
              <EvolutionTable points={points} />
            </div>
          </Card>
        </>
      )}
    </Shell>
  );
}
