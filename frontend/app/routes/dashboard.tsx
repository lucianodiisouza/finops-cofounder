import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { EvolutionChart } from "~/components/charts";
import { MonthPicker } from "~/components/MonthPicker";
import { ProjectDialog } from "~/components/ProjectDialog";
import { Shell } from "~/components/Shell";
import { Badge, Button, Card, EmptyState, Notice, Swatch } from "~/components/ui";
import { api, type Dashboard, type EvolutionPoint } from "~/lib/api";
import { seriesColor } from "~/lib/colors";
import { currentMonth, formatBRL, formatMonthLong, formatPercent } from "~/lib/format";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";

export const meta: Route.MetaFunction = () => [{ title: "Painel do mês — FinOps" }];

export default function DashboardPage() {
  const { user, loading } = useSession();
  const { isDark } = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Dashboard | null>(null);
  const [evolution, setEvolution] = useState<EvolutionPoint[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [dashboard, projects, series] = await Promise.all([
        api.dashboard(month),
        api.listProjects(),
        api.evolution(month, 12),
      ]);
      setData(dashboard);
      setProjectCount(projects.length);
      setEvolution(series.months);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o painel.");
    }
  }, [month]);

  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const hasProjects = projectCount > 0;
  const deltaTone =
    !data || data.delta_cents === 0 ? "neutral" : data.delta_cents > 0 ? "up" : "down";

  return (
    <Shell email={user.email}>
      <div className="enter flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-3">
            Total do mês
          </p>
          <h1 className="tnum mt-1 text-5xl font-semibold leading-none text-ink sm:text-6xl">
            {data ? formatBRL(data.total_cents) : "—"}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            em {formatMonthLong(month)}
            {data && data.previous_total_cents > 0 && (
              <>
                {" · "}
                <span
                  className={
                    deltaTone === "up" ? "text-alert" : deltaTone === "down" ? "text-good" : ""
                  }
                >
                  {data.delta_cents > 0 ? "+" : data.delta_cents < 0 ? "−" : ""}
                  {formatBRL(Math.abs(data.delta_cents))}
                  {data.delta_percent !== null && ` (${formatPercent(data.delta_percent)})`}
                </span>{" "}
                sobre o mês anterior
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          <Button onClick={() => setDialogOpen(true)}>+ Novo projeto</Button>
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {data && data.missing_currencies.length > 0 && (
        <div className="mt-6">
          <Notice>
            Há serviços em {data.missing_currencies.join(" e ")} sem cotação cadastrada. Eles
            ficam fora do total até você{" "}
            <Link to="/cotacoes" className="font-semibold underline underline-offset-4">
              informar a cotação
            </Link>
            .
          </Notice>
        </div>
      )}

      <Card className="mt-7">
        <header className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3 sm:px-6">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Custo por projeto
          </h2>
          {data && data.projects.length > 0 && (
            <span className="text-xs text-ink-3">
              {data.projects.length} {data.projects.length === 1 ? "projeto" : "projetos"}
            </span>
          )}
        </header>

        {!data ? (
          <p className="px-6 py-10 text-sm text-ink-3">Carregando…</p>
        ) : !hasProjects ? (
          <EmptyState
            title="Comece pelo primeiro projeto"
            description="Crie um projeto e cadastre os serviços que você paga nele — servidor, banco, domínio, APIs. O FinOps calcula o custo mensal em reais."
            action={<Button onClick={() => setDialogOpen(true)}>+ Criar projeto</Button>}
          />
        ) : data.projects.length === 0 ? (
          <EmptyState
            title="Nenhum custo neste mês"
            description={`Nenhum serviço estava vigente em ${formatMonthLong(month)}. Abra um projeto para cadastrar os serviços que você paga.`}
          />
        ) : (
          <ul>
            {data.projects.map((project) => (
              <li key={project.project_id} className="rule-row last:border-b-0">
                <Link
                  to={`/projetos/${project.project_id}`}
                  className="group flex cursor-pointer flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <Swatch color={seriesColor(project.color, isDark)} />
                      <span className="truncate font-semibold text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">
                        {project.name}
                      </span>
                      {project.missing_rate && <Badge tone="alert">cotação pendente</Badge>}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="tnum text-xs text-ink-3">
                        {formatPercent(project.share_percent, false)}
                      </span>
                      <span className="tnum text-lg font-semibold text-ink">
                        {formatBRL(project.total_cents)}
                      </span>
                    </span>
                  </div>
                  {/* Barra de participação: rótulo direto ao lado garante que a leitura
                      não dependa só da cor. */}
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.max(project.share_percent, 1.5)}%`,
                          backgroundColor: seriesColor(project.color, isDark),
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-ink-3">
                      {project.service_count}{" "}
                      {project.service_count === 1 ? "serviço" : "serviços"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {hasProjects && evolution.some((point) => point.total_cents > 0) && (
        <Card className="mt-6 p-5 sm:p-6">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Últimos 12 meses
            </h2>
            <Link
              to="/evolucao"
              className="cursor-pointer text-xs font-semibold text-accent underline decoration-accent/40 underline-offset-4"
            >
              ver a evolução completa
            </Link>
          </header>
          <div className="mt-5">
            <EvolutionChart points={evolution} isDark={isDark} mode="stacked" />
          </div>
        </Card>
      )}

      <ProjectDialog
        open={dialogOpen}
        existingCount={projectCount}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void reload()}
      />
    </Shell>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-ink-3">Carregando…</p>
    </div>
  );
}
