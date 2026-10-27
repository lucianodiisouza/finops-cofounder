/** Primitivas de interface do FinOps, no estilo livro-caixa (ver ADR 004). */
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper hover:bg-ink-2 border border-ink disabled:bg-ink-3 disabled:border-ink-3",
  secondary:
    "bg-surface text-ink border border-rule-strong hover:border-ink hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-surface-2",
  danger: "bg-transparent text-alert border border-alert/40 hover:bg-alert-soft hover:border-alert",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm px-4 py-2 " +
        "text-sm font-semibold transition-colors duration-150 " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        buttonStyles[variant] +
        " " +
        className
      }
    />
  );
}

/**
 * Campo de formulário com rótulo, dica e erro.
 *
 * A dica e o erro ficam FORA do elemento <label> e são ligados ao controle por
 * aria-describedby. Dentro do label eles entrariam no nome acessível do campo,
 * que passaria a ser "Valor Use vírgula para os centavos" em vez de "Valor".
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control =
    describedBy && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": describedBy,
        })
      : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
          {label}
        </span>
        {control}
      </label>
      {hint && !error && (
        <span id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="text-xs font-medium text-alert">
          {error}
        </span>
      )}
    </div>
  );
}

const controlClass =
  "w-full rounded-sm border border-rule-strong bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-3 transition-colors focus:border-accent";

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${className}`} />;
}

export function Select({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} cursor-pointer ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} resize-y ${className}`} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section
      // min-w-0: dentro de um grid, sem isso o cartão não encolhe e o conteúdo
      // rolável (gráficos, tabelas) alarga a página inteira no celular.
      className={`min-w-0 rounded-sm border border-rule bg-surface shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "alert" | "accent";
}) {
  const tones = {
    neutral: "border-rule-strong text-ink-3",
    alert: "border-alert/40 bg-alert-soft text-alert",
    accent: "border-accent/40 bg-accent-soft text-accent",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Marcador de cor de um projeto ou série de gráfico. */
export function Swatch({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc fecha o diálogo e o foco vai para o painel ao abrir.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="enter relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-lg border border-rule bg-surface p-6 shadow-[var(--shadow)] outline-none sm:rounded-sm"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-3xl leading-none text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer text-xl leading-none text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Aviso destacado, usado para cotações pendentes e erros de formulário. */
export function Notice({
  tone = "alert",
  children,
}: {
  tone?: "alert" | "accent";
  children: ReactNode;
}) {
  const tones = {
    alert: "border-alert/40 bg-alert-soft text-alert",
    accent: "border-accent/40 bg-accent-soft text-accent",
  };
  return (
    <p className={`rounded-sm border px-3 py-2 text-sm ${tones[tone]}`} role="status">
      {children}
    </p>
  );
}

/** Estado vazio: convida à primeira ação em vez de mostrar uma tela em branco. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-14">
      <h3 className="font-display text-3xl leading-tight text-ink">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{description}</p>
      {action}
    </div>
  );
}
