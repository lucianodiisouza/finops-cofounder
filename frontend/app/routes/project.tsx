import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Route } from "./+types/project";
import { CategoryBars, EvolutionChart } from "~/components/charts";
import { MonthPicker } from "~/components/MonthPicker";
import { ProjectDialog } from "~/components/ProjectDialog";
import { ServiceDialog } from "~/components/ServiceDialog";
import { Shell } from "~/components/Shell";
import { Badge, Button, Card, EmptyState, Notice, Swatch } from "~/components/ui";
import { api, type ProjectSummary, type Service } from "~/lib/api";
import { seriesColor } from "~/lib/colors";
import {
  categoryLabels,
  currentMonth,
  cycleLabels,
  formatBRL,
  formatDate,
  formatMoney,
  formatMonthLong,
} from "~/lib/format";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";
import { LoadingScreen } from "./dashboard";

export const meta: Route.MetaFunction = () => [{ title: "Projeto — FinOps" }];

export default function ProjectPage() {
  const { id = "" } = useParams();
  const { user, loading } = useSession();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState("");
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service?: Service }>({
    open: false,
  });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSummary(await api.projectSummary(id, month));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o projeto.");
    }
  }, [id, month]);

  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  const removeService = async (service: Service) => {
    if (!confirm(`Excluir o serviço "${service.name}"? Essa ação não pode ser desfeita.`)) return;
    await api.deleteService(service.id);
    void reload();
  };

  const toggleArchive = async () => {
    if (!summary) return;
    await api.archiveProject(summary.project.id, !summary.project.archived);
    void reload();
  };

  const removeProject = async () => {
    if (!summary) return;
    if (
      !confirm(
        `Excluir o projeto "${summary.project.name}" e todo o histórico de custos dele? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    await api.deleteProject(summary.project.id);
    navigate("/", { replace: true });
  };

  if (loading || !user) return <LoadingScreen />;

  return (
    <Shell email={user.email}>
      <Link
        to="/"
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-3 transition-colors hover:text-ink"
      >
        ‹ Painel
      </Link>

      {error && (
        <div className="mt-5">
          <Notice>{error}</Notice>
        </div>
      )}

      {!summary ? (
        <p className="mt-8 text-sm text-ink-3">Carregando…</p>
      ) : (
        <>
          <div className="enter mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="flex items-center gap-2">
                <Swatch color={seriesColor(summary.project.color, isDark)} className="size-3" />
                <h1 className="font-display text-4xl leading-none text-ink sm:text-5xl">
                  {summary.project.name}
                </h1>
                {summary.project.archived && <Badge>arquivado</Badge>}
              </span>
              {summary.project.description && (
                <p className="mt-2 max-w-xl text-sm text-ink-2">{summary.project.description}</p>
              )}
              <p className="tnum mt-4 text-3xl font-semibold text-ink">
                {formatBRL(summary.total_cents)}
                <span className="ml-2 font-sans text-sm font-normal text-ink-3">
                  em {formatMonthLong(month)}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MonthPicker month={month} onChange={setMonth} />
              <Button onClick={() => setServiceDialog({ open: true })}>+ Novo serviço</Button>
            </div>
          </div>

          {summary.missing_currencies.length > 0 && (
            <div className="mt-6">
              <Notice>
                Serviços em {summary.missing_currencies.join(" e ")} sem cotação para este mês
                ficam fora do total.{" "}
                <Link to="/cotacoes" className="font-semibold underline underline-offset-4">
                  Cadastrar cotação
                </Link>
                .
              </Notice>
            </div>
          )}

          <Card className="mt-7">
            <header className="border-b border-rule px-5 py-3 sm:px-6">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Serviços vigentes em {formatMonthLong(month)}
              </h2>
            </header>

            {summary.services.length === 0 ? (
              <EmptyState
                title="Nenhum serviço neste mês"
                description="Cadastre os serviços que você paga neste projeto: servidor, banco de dados, domínio, APIs, assinaturas."
                action={
                  <Button onClick={() => setServiceDialog({ open: true })}>
                    + Cadastrar serviço
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left">
                      {["Serviço", "Categoria", "Ciclo", "Valor original", "Em reais", ""].map(
                        (header, index) => (
                          <th
                            key={header || index}
                            scope="col"
                            className={
                              "px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 " +
                              (index >= 3 ? "text-right" : "")
                            }
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.services.map((service) => (
                      <tr key={service.id} className="rule-row last:border-b-0">
                        <td className="px-4 py-3 pl-5 sm:pl-6">
                          <span className="font-semibold text-ink">{service.name}</span>
                          <span className="mt-0.5 block text-xs text-ink-3">
                            desde {formatDate(service.starts_on)}
                            {service.ends_on && ` · até ${formatDate(service.ends_on)}`}
                            {service.notes && ` · ${service.notes}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          {categoryLabels[service.category] ?? service.category}
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          {cycleLabels[service.billing_cycle]}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-ink-2">
                          {formatMoney(service.amount_cents, service.currency)}
                          {service.billing_cycle === "yearly" && (
                            <span className="ml-1 font-sans text-xs text-ink-3">/ano</span>
                          )}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-semibold text-ink">
                          {service.missing_rate ? (
                            <Badge tone="alert">cotação pendente</Badge>
                          ) : (
                            formatBRL(service.converted_cents)
                          )}
                        </td>
                        <td className="px-4 py-3 pr-5 text-right sm:pr-6">
                          <span className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setServiceDialog({ open: true, service })}
                              className="cursor-pointer rounded-sm px-2 py-1 text-xs font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeService(service)}
                              className="cursor-pointer rounded-sm px-2 py-1 text-xs font-semibold text-ink-3 transition-colors hover:bg-alert-soft hover:text-alert"
                            >
                              Excluir
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card className="p-5 sm:p-6">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Custo por categoria
              </h2>
              <div className="mt-4">
                {summary.categories.length === 0 ? (
                  <p className="text-sm text-ink-3">Sem custos neste mês.</p>
                ) : (
                  <CategoryBars categories={summary.categories} />
                )}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Evolução dos últimos 12 meses
              </h2>
              <div className="mt-4">
                <EvolutionChart points={summary.evolution} isDark={isDark} mode="total" />
              </div>
            </Card>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-rule pt-5">
            <Button variant="secondary" onClick={() => setProjectDialogOpen(true)}>
              Editar projeto
            </Button>
            <Button variant="secondary" onClick={() => void toggleArchive()}>
              {summary.project.archived ? "Reativar projeto" : "Arquivar projeto"}
            </Button>
            <Button variant="danger" className="ml-auto" onClick={() => void removeProject()}>
              Excluir projeto
            </Button>
          </div>

          <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-3">
            Arquivar mantém o histórico mas tira o projeto dos totais. Excluir apaga o projeto e
            todos os serviços dele, sem possibilidade de recuperação.
          </p>

          <ServiceDialog
            open={serviceDialog.open}
            projectId={id}
            service={serviceDialog.service}
            month={month}
            onClose={() => setServiceDialog({ open: false })}
            onSaved={() => void reload()}
          />
          <ProjectDialog
            open={projectDialogOpen}
            project={summary.project}
            existingCount={0}
            onClose={() => setProjectDialogOpen(false)}
            onSaved={() => void reload()}
          />
        </>
      )}
    </Shell>
  );
}
