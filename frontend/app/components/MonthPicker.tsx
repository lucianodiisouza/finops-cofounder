import { currentMonth, formatMonthLong, shiftMonth } from "~/lib/format";

/** Seletor de mês: setas para navegar e um atalho para voltar ao mês atual. */
export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = month === currentMonth();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mês anterior"
        className="size-8 cursor-pointer rounded-sm border border-rule-strong bg-surface text-ink-2 transition-colors hover:border-ink hover:text-ink"
      >
        ‹
      </button>
      <span className="min-w-[10.5rem] text-center text-sm font-semibold text-ink">
        {formatMonthLong(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Mês seguinte"
        className="size-8 cursor-pointer rounded-sm border border-rule-strong bg-surface text-ink-2 transition-colors hover:border-ink hover:text-ink"
      >
        ›
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentMonth())}
          className="ml-1 cursor-pointer text-xs font-semibold text-accent underline decoration-accent/40 underline-offset-4"
        >
          mês atual
        </button>
      )}
    </div>
  );
}
