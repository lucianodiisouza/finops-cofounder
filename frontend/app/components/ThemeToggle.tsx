import { useTheme, type ThemeMode } from "~/lib/theme";

const options: { mode: ThemeMode; label: string; glyph: string }[] = [
  { mode: "light", label: "Tema claro", glyph: "☀" },
  { mode: "dark", label: "Tema escuro", glyph: "☾" },
  { mode: "system", label: "Seguir o sistema", glyph: "◐" },
];

export function ThemeToggle() {
  const { mode, changeMode } = useTheme();

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center gap-0.5 rounded-full border border-rule bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => changeMode(option.mode)}
          title={option.label}
          aria-label={option.label}
          aria-pressed={mode === option.mode}
          className={
            "size-7 cursor-pointer rounded-full text-xs transition-colors " +
            (mode === option.mode
              ? "bg-ink text-paper"
              : "text-ink-3 hover:bg-surface-2 hover:text-ink")
          }
        >
          {option.glyph}
        </button>
      ))}
    </div>
  );
}
