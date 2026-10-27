import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "finops-theme";

function readMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && prefersDark());
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  return dark;
}

/**
 * Controla o tema em três estados — claro, escuro e sistema (padrão).
 * O atributo data-theme é escrito direto no DOM, nunca via JSX, para não
 * conflitar com o script inline que roda antes da primeira pintura.
 */
export function useTheme() {
  // Inicialização preguiçosa: a aplicação é um SPA puro, então a primeira
  // renderização já acontece no navegador e pode ler o localStorage direto.
  // Sem isso o seletor pisca em "sistema" antes do efeito rodar.
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const [isDark, setIsDark] = useState(() => mode === "dark" || (mode === "system" && prefersDark()));

  useEffect(() => {
    setIsDark(applyMode(mode));
    // Só no carregamento: as mudanças posteriores passam por changeMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Com o modo "sistema", acompanha mudanças de preferência do sistema operacional.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(applyMode("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const changeMode = (next: ThemeMode) => {
    setMode(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setIsDark(applyMode(next));
  };

  return { mode, isDark, changeMode };
}
