import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { EvolutionChart } from "~/components/charts";
import { MonthPicker } from "~/components/MonthPicker";
import { ProjectDialog } from "~/components/ProjectDialog";
import { Shell } from "~/components/Shell";
import { Badge, Button, Card, EmptyState, Notice, Swatch } from "~/components/ui";
import { api, type Dashboard, type DashboardProject, type EvolutionPoint } from "~/lib/api";
import { seriesColor } from "~/lib/colors";
import { currentMonth, formatBRL, formatMonthLong, formatPercent } from "~/lib/format";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";

export const meta: Route.MetaFunction = () => [{ title: "Painel do mês — FinOps" }];

/** Quantos meses o gráfico de cada projeto mostra. */
const historyMonths = 12;

type ScaleMode = "shared" | "own";

export default function DashboardPage() {
  const { user, loading } = useSession();
  const { isDark } = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Dashboard | null>(null);
  const [evolution, setEvolution] = useState<EvolutionPoint[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("shared");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [dashboard, projects, series] = await Promise.all([
        api.dashboard(month),
        api.listProjects(),
        api.evolution(month, historyMonths),
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

  /**
   * Pivota a série do painel (um ponto por mês, com todos os projetos dentro)
   * para uma série por projeto, que é o formato que cada cartão desenha.
   * Meses em que o projeto não tinha custo viram zero, para o eixo do tempo
   * continuar contínuo em todos os cartões.
   */
  const seriesByProject = useMemo(() => {
    const byProject = new Map<string, EvolutionPoint[]>();
    for (const project of data?.projects ?? []) {
      byProject.set(
        project.project_id,
        evolution.map((point) => ({
          month: point.month,
          total_cents:
            point.projects.find((p) => p.project_id === project.project_id)?.total_cents ?? 0,
          projects: [],
        })),
      );
    }
    return byProject;
  }, [data, evolution]);

  // Com escala compartilhada, o teto vem do maior valor que qualquer projeto já
  // teve no período — é o que torna os cartões comparáveis entre si.
  const sharedMax = useMemo(
    () =>
      Math.max(
        1,
        ...evolution.flatMap((point) => point.projects.map((project) => project.total_cents)),
      ),
    [evolution],
  );

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const hasProjects = projectCount > 0;
  const hasHistory = evolution.some((point) => point.total_cents > 0);
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

      {!data ? (
        <p className="mt-8 text-sm text-ink-3">Carregando…</p>
      ) : !hasProjects ? (
        <Card className="mt-7">
          <EmptyState
            title="Comece pelo primeiro projeto"
            description="Crie um projeto e cadastre os serviços que você paga nele — servidor, banco, domínio, APIs. O FinOps calcula o custo mensal em reais."
            action={<Button onClick={() => setDialogOpen(true)}>+ Criar projeto</Button>}
          />
        </Card>
      ) : data.projects.length === 0 ? (
        <Card className="mt-7">
          <EmptyState
            title="Nenhum custo neste mês"
            description={`Nenhum serviço estava vigente em ${formatMonthLong(month)}. Abra um projeto para cadastrar os serviços que você paga.`}
          />
        </Card>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Custo por projeto · {data.projects.length}{" "}
              {data.projects.length === 1 ? "projeto" : "projetos"}
            </h2>

            {hasHistory && data.projects.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">Escala dos gráficos</span>
                <div
                  role="group"
                  aria-label="Escala dos gráficos"
                  className="flex items-center gap-0.5 rounded-sm border border-rule bg-surface p-0.5"
                >
                  {(
                    [
                      { value: "shared", label: "Comparável" },
                      { value: "own", label: "Própria" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScaleMode(option.value)}
                      aria-pressed={scaleMode === option.value}
                      title={
                        option.value === "shared"
                          ? "Todos os gráficos usam o mesmo eixo, então as alturas podem ser comparadas entre projetos"
                          : "Cada gráfico usa o próprio eixo, o que destaca a variação de projetos pequenos"
                      }
                      className={
                        "cursor-pointer rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors " +
                        (scaleMode === option.value
                          ? "bg-ink text-paper"
                          : "text-ink-3 hover:bg-surface-2 hover:text-ink")
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {data.projects.map((project) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                points={seriesByProject.get(project.project_id) ?? []}
                isDark={isDark}
                fixedMax={scaleMode === "shared" ? sharedMax : undefined}
              />
            ))}
          </div>

          {hasHistory && (
            <p className="mt-5 text-xs text-ink-3">
              Cada gráfico mostra os últimos {historyMonths} meses.{" "}
              {scaleMode === "shared"
                ? "Os eixos são iguais, então as alturas podem ser comparadas entre projetos."
                : "Cada eixo é independente: as alturas mostram a variação de cada projeto, mas não podem ser comparadas entre si."}{" "}
              <Link
                to="/evolucao"
                className="cursor-pointer font-semibold text-accent underline decoration-accent/40 underline-offset-4"
              >
                Ver a evolução somada
              </Link>
            </p>
          )}
        </>
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

/** Cartão de um projeto: total do mês, variação e evolução dos últimos meses. */
function ProjectCard({
  project,
  points,
  isDark,
  fixedMax,
}: {
  project: DashboardProject;
  points: EvolutionPoint[];
  isDark: boolean;
  fixedMax?: number;
}) {
  const color = seriesColor(project.color, isDark);

  // Variação do próprio projeto: último mês da série contra o anterior.
  const previous = points.length >= 2 ? points[points.length - 2].total_cents : null;
  const delta = previous === null ? null : project.total_cents - previous;
  const hasHistory = points.some((point) => point.total_cents > 0);

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <span className="flex min-w-0 items-center gap-2">
          <Swatch color={color} />
          <Link
            to={`/projetos/${project.project_id}`}
            className="truncate font-semibold text-ink underline decoration-transparent underline-offset-4 transition-colors hover:decoration-rule-strong"
          >
            {project.name}
          </Link>
          {project.missing_rate && <Badge tone="alert">cotação pendente</Badge>}
        </span>
        <span className="tnum shrink-0 text-xs text-ink-3">
          {formatPercent(project.share_percent, false)} do total
        </span>
      </header>

      <p className="tnum mt-3 text-3xl font-semibold leading-none text-ink">
        {formatBRL(project.total_cents)}
      </p>

      <p className="mt-2 text-xs text-ink-2">
        {delta === null || previous === 0 ? (
          <span className="text-ink-3">sem base de comparação no mês anterior</span>
        ) : delta === 0 ? (
          <span className="text-ink-3">sem mudança sobre o mês anterior</span>
        ) : (
          <>
            <span className={delta > 0 ? "text-alert" : "text-good"}>
              {delta > 0 ? "+" : "−"}
              {formatBRL(Math.abs(delta))}
            </span>{" "}
            sobre o mês anterior
          </>
        )}
        {" · "}
        {project.service_count} {project.service_count === 1 ? "serviço" : "serviços"}
      </p>

      <div className="mt-4">
        {hasHistory ? (
          <EvolutionChart
            points={points}
            isDark={isDark}
            mode="total"
            color={color}
            fixedMax={fixedMax}
            compact
          />
        ) : (
          <p className="py-8 text-center text-xs text-ink-3">
            Ainda não há histórico para este projeto.
          </p>
        )}
      </div>
    </Card>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-ink-3">Carregando…</p>
    </div>
  );
}
