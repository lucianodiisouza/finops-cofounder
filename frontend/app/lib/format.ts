/** Formatação pt-BR de dinheiro, datas e meses. Os valores chegam da API em centavos. */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const currencyFormatters: Record<string, Intl.NumberFormat> = {
  BRL: brl,
  USD: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }),
  EUR: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }),
};

/** Formata centavos em reais: 123456 → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Formata centavos em reais sem casas decimais, para rótulos de gráfico. */
export function formatBRLShort(cents: number): string {
  return brlCompact.format(cents / 100);
}

/** Formata centavos na moeda informada: (1290, "EUR") → "€ 12,90". */
export function formatMoney(cents: number, currency: string): string {
  const formatter = currencyFormatters[currency] ?? brl;
  return formatter.format(cents / 100);
}

/** Converte "1.234,56", "1234.56" ou "1234,56" em centavos. Devolve null se inválido. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,-]/g, "");
  if (cleaned === "") return null;
  // Se tem vírgula, ela é o separador decimal e o ponto é separador de milhar.
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Converte centavos em texto editável no formato brasileiro: 123456 → "1234,56". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Interpreta "5,42" ou "5.42" como número. Devolve null se inválido.
 * O ponto só é tratado como separador de milhar quando há uma vírgula decimal —
 * sem isso, quem digita "5.42" acabaria com 542.
 */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim();
  if (cleaned === "") return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const monthNames = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const monthAbbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "outubro de 2026". */
export function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  return `${monthNames[Number(m) - 1]} de ${year}`;
}

/** "2026-10" → "out/26", para eixos de gráfico. */
export function formatMonthShort(month: string): string {
  const [year, m] = month.split("-");
  return `${monthAbbr[Number(m) - 1]}/${year.slice(2)}`;
}

/** "2026-10-05" → "05/10/2026". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Mês atual no formato "YYYY-MM", pelo calendário local. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro dia do mês no formato "YYYY-MM-DD". */
export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

/** Desloca um mês "YYYY-MM" em `delta` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Formata uma variação percentual: 12.345 → "+12,3%". */
export function formatPercent(value: number, withSign = true): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  const sign = !withSign ? "" : value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatted}%`;
}

export const categoryLabels: Record<string, string> = {
  servidor: "Servidor",
  banco: "Banco de dados",
  dominio: "Domínio",
  api: "API",
  armazenamento: "Armazenamento",
  monitoramento: "Monitoramento",
  outro: "Outro",
};

export const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
};
