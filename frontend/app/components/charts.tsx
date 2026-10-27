/**
 * Gráficos do FinOps, em SVG puro.
 *
 * Decisões que seguem o guia de visualização de dados:
 * - marcas finas, com a ponta de dados arredondada em 4px e ancorada na linha de base;
 * - folga de 2px da cor da superfície entre segmentos empilhados e entre barras;
 * - grade e eixos recessivos (cor de filete), rótulos em tinta suave;
 * - legenda sempre presente a partir de 2 séries, com rótulo direto até 4;
 * - camada de hover com tooltip por marca;
 * - um eixo só; nunca dois eixos y.
 * A paleta categórica usada aqui é validada para daltonismo (ver ADR 004).
 */
import { useMemo, useState } from "react";
import type { EvolutionPoint } from "~/lib/api";
import { seriesColor } from "~/lib/colors";
import { categoryLabels, formatBRL, formatBRLShort, formatMonthShort } from "~/lib/format";

/** Caminho de um retângulo com arredondamento opcional apenas no topo. */
function barPath(x: number, y: number, width: number, height: number, topRadius: number): string {
  const r = Math.max(0, Math.min(topRadius, width / 2, height));
  if (r === 0) return `M${x} ${y}h${width}v${height}h${-width}Z`;
  return (
    `M${x} ${y + r}` +
    `a${r} ${r} 0 0 1 ${r} ${-r}` +
    `h${width - 2 * r}` +
    `a${r} ${r} 0 0 1 ${r} ${r}` +
    `v${height - r}h${-width}Z`
  );
}

/**
 * Monta a escala do eixo com um passo "redondo" (1, 2, 2,5 ou 5 vezes uma
 * potência de dez), de forma que os rótulos da grade sejam valores legíveis
 * como R$ 200 e R$ 400, em vez de R$ 188 e R$ 563.
 */
export function niceScale(maxValue: number, targetSteps = 4): { max: number; values: number[] } {
  if (maxValue <= 0) return { max: 1, values: [0, 1] };

  const rough = maxValue / targetSteps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;

  const max = Math.ceil(maxValue / step) * step;
  const values: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    values.push(Math.round(value));
  }
  return { max, values };
}

const GAP = 2; // folga da cor da superfície entre marcas, em px do viewBox

type EvolutionChartProps = {
  points: EvolutionPoint[];
  isDark: boolean;
  /** "stacked" empilha por projeto; "total" desenha uma série só. */
  mode?: "stacked" | "total";
  /** Cor da série única. Só vale no modo "total"; o padrão é a cor de destaque. */
  color?: string;
  /**
   * Teto do eixo imposto de fora, em centavos. Usado quando vários gráficos
   * aparecem lado a lado e precisam compartilhar a escala para serem comparáveis.
   */
  fixedMax?: number;
  /** Versão reduzida, para caber dentro de um cartão. */
  compact?: boolean;
};

export function EvolutionChart({
  points,
  isDark,
  mode = "stacked",
  color,
  fixedMax,
  compact = false,
}: EvolutionChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Séries na ordem de maior custo acumulado, para a legenda e a pilha ficarem estáveis.
  const series = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; total: number }>();
    for (const point of points) {
      for (const project of point.projects) {
        const current = totals.get(project.project_id);
        totals.set(project.project_id, {
          name: project.name,
          color: project.color,
          total: (current?.total ?? 0) + project.total_cents,
        });
      }
    }
    return [...totals.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [points]);

  const highest = Math.max(fixedMax ?? 0, ...points.map((p) => p.total_cents), 1);
  const { max, values: gridValues } = niceScale(highest, compact ? 2 : 4);
  // A largura reduzida é calibrada para o gráfico caber inteiro dentro de um
  // cartão na largura de um celular, sem cortar o rótulo do último mês.
  const width = compact ? 340 : 720;
  const height = compact ? 150 : 260;
  const padding = compact
    ? { top: 12, right: 8, bottom: 24, left: 54 }
    : { top: 16, right: 12, bottom: 30, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(compact ? 22 : 38, slot * 0.6);
  const scale = (cents: number) => (cents / max) * plotHeight;
  // Na versão reduzida há espaço para poucos rótulos: um a cada três meses,
  // sempre incluindo o último.
  const labelEvery = compact ? 3 : 1;

  const hoveredPoint = hovered === null ? null : points[hovered];

  return (
    <div className="relative">
      {/* No celular o gráfico rola na horizontal: encolher a largura toda deixaria
          os rótulos dos meses ilegíveis. */}
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={compact ? "w-full min-w-[18rem]" : "w-full min-w-[34rem]"}
        role="img"
        aria-label={
          mode === "stacked"
            ? "Custo mensal total, empilhado por projeto"
            : "Custo mensal do projeto, mês a mês"
        }
      >
        {/* Grade recessiva: filetes do livro-caixa. */}
        {gridValues.map((value) => {
          const y = padding.top + plotHeight - scale(value);
          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--rule)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="tnum"
                fontSize={compact ? 9 : 10}
                fill="var(--ink-3)"
              >
                {formatBRLShort(value)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const x = padding.left + index * slot + (slot - barWidth) / 2;
          const stack =
            mode === "stacked"
              ? series
                  .map((s) => point.projects.find((p) => p.project_id === s.id))
                  .filter((p): p is NonNullable<typeof p> => !!p && p.total_cents > 0)
              : point.total_cents > 0
                ? [{ project_id: "total", name: "Total", color: "", total_cents: point.total_cents }]
                : [];

          let cursor = padding.top + plotHeight;
          const isHovered = hovered === index;

          return (
            <g
              key={point.month}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              className="cursor-pointer outline-none"
            >
              {/* Alvo de hover maior que a marca, cobrindo a coluna inteira. */}
              <rect
                x={padding.left + index * slot}
                y={padding.top}
                width={slot}
                height={plotHeight}
                fill={isHovered ? "var(--surface-2)" : "transparent"}
              />
              {stack.map((segment, segmentIndex) => {
                const rawHeight = scale(segment.total_cents);
                const isTop = segmentIndex === stack.length - 1;
                const segmentHeight = Math.max(rawHeight - (isTop ? 0 : GAP), 1);
                const y = cursor - segmentHeight;
                cursor -= rawHeight;
                const fill =
                  mode === "total"
                    ? (color ?? "var(--accent)")
                    : seriesColor(segment.color, isDark);
                return (
                  <path
                    key={segment.project_id}
                    d={barPath(x, y, barWidth, segmentHeight, isTop ? 4 : 0)}
                    fill={fill}
                    opacity={hovered === null || isHovered ? 1 : 0.45}
                  />
                );
              })}
              {(points.length - 1 - index) % labelEvery === 0 && (
                <text
                  x={padding.left + index * slot + slot / 2}
                  y={height - (compact ? 8 : 10)}
                  textAnchor="middle"
                  fontSize={compact ? 9 : 10}
                  fill={isHovered ? "var(--ink)" : "var(--ink-3)"}
                >
                  {formatMonthShort(point.month)}
                </text>
              )}
            </g>
          );
        })}

        {/* Linha de base, um pouco mais firme que a grade. */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
      </svg>
      </div>

      {hoveredPoint && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 w-56 -translate-x-1/2 rounded-sm border border-rule bg-surface p-3 shadow-[var(--shadow)] sm:w-60">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {formatMonthShort(hoveredPoint.month)}
          </p>
          <p className="tnum mt-0.5 text-lg font-semibold text-ink">
            {formatBRL(hoveredPoint.total_cents)}
          </p>
          {mode === "stacked" && hoveredPoint.projects.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-rule pt-2">
              {[...hoveredPoint.projects]
                .sort((a, b) => b.total_cents - a.total_cents)
                .map((project) => (
                  <li
                    key={project.project_id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: seriesColor(project.color, isDark) }}
                      />
                      <span className="truncate">{project.name}</span>
                    </span>
                    <span className="tnum shrink-0 text-ink">
                      {formatBRL(project.total_cents)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Legenda: obrigatória a partir de duas séries, para a identidade não ser só cor. */}
      {mode === "stacked" && series.length >= 2 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-rule pt-3">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: seriesColor(s.color, isDark) }}
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Barras horizontais por categoria: uma série só, com rótulo direto em cada barra. */
export function CategoryBars({
  categories,
}: {
  categories: { category: string; total_cents: number }[];
}) {
  const max = Math.max(...categories.map((c) => c.total_cents), 1);

  return (
    <ul className="flex flex-col gap-3">
      {categories.map((item) => (
        <li key={item.category} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-2">
              {categoryLabels[item.category] ?? item.category}
            </span>
            <span className="tnum text-sm font-semibold text-ink">
              {formatBRL(item.total_cents)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.max((item.total_cents / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tabela de evolução: a visão em números que acompanha o gráfico. */
export function EvolutionTable({ points }: { points: EvolutionPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <caption className="sr-only">Custo total por mês e variação sobre o mês anterior</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <th scope="col" className="py-2 pr-4 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Mês
            </th>
            <th scope="col" className="py-2 pr-4 text-right text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Total
            </th>
            <th scope="col" className="py-2 text-right text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Variação
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => {
            const previous = index > 0 ? points[index - 1].total_cents : null;
            const delta = previous === null ? null : point.total_cents - previous;
            return (
              <tr key={point.month} className="rule-row">
                <td className="py-2 pr-4 text-ink-2">{formatMonthShort(point.month)}</td>
                <td className="tnum py-2 pr-4 text-right font-semibold text-ink">
                  {formatBRL(point.total_cents)}
                </td>
                <td
                  className={
                    "tnum py-2 text-right " +
                    (delta === null || delta === 0
                      ? "text-ink-3"
                      : delta > 0
                        ? "text-alert"
                        : "text-good")
                  }
                >
                  {delta === null
                    ? "—"
                    : delta === 0
                      ? "sem mudança"
                      : `${delta > 0 ? "+" : "−"}${formatBRL(Math.abs(delta))}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
