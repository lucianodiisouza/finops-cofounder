import { describe, expect, test } from "vitest";
import {
  centsToInput,
  currentMonth,
  firstDayOfMonth,
  formatBRL,
  formatBRLShort,
  formatDate,
  formatMoney,
  formatMonthLong,
  formatMonthShort,
  formatPercent,
  parseAmountToCents,
  parseDecimal,
  shiftMonth,
} from "./format";

// O espaço que o Intl insere depois do símbolo é um NBSP, não um espaço comum.
const normalize = (value: string) => value.replace(/ /g, " ");

describe("formatação de dinheiro", () => {
  test("formata centavos em reais", () => {
    expect(normalize(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(normalize(formatBRL(0))).toBe("R$ 0,00");
    expect(normalize(formatBRL(333))).toBe("R$ 3,33");
  });

  test("formata sem centavos para rótulos de gráfico", () => {
    expect(normalize(formatBRLShort(123456))).toBe("R$ 1.235");
  });

  test("formata na moeda de origem do serviço", () => {
    expect(normalize(formatMoney(1290, "EUR"))).toContain("12,90");
    expect(normalize(formatMoney(2500, "USD"))).toContain("25,00");
    expect(normalize(formatMoney(7900, "BRL"))).toBe("R$ 79,00");
  });

  test("moeda desconhecida cai para reais em vez de quebrar", () => {
    expect(normalize(formatMoney(100, "XYZ"))).toBe("R$ 1,00");
  });
});

describe("leitura de valores digitados", () => {
  test.each([
    ["79,90", 7990],
    ["79.90", 7990],
    ["1.234,56", 123456],
    ["1234.56", 123456],
    ["  12  ", 1200],
    ["R$ 45,00", 4500],
    ["0", 0],
  ])("interpreta %s como %i centavos", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  test.each(["", "   ", "abc", "-10"])("rejeita %s", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });

  test("ida e volta entre centavos e campo editável", () => {
    expect(centsToInput(7990)).toBe("79,90");
    expect(parseAmountToCents(centsToInput(123456))).toBe(123456);
  });

  test("interpreta cotações decimais", () => {
    expect(parseDecimal("5,42")).toBe(5.42);
    expect(parseDecimal("5.42")).toBe(5.42);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});

describe("meses e datas", () => {
  test("escreve o mês por extenso em português", () => {
    expect(formatMonthLong("2026-10")).toBe("outubro de 2026");
    expect(formatMonthLong("2026-03")).toBe("março de 2026");
  });

  test("abrevia o mês para o eixo do gráfico", () => {
    expect(formatMonthShort("2026-10")).toBe("out/26");
    expect(formatMonthShort("2026-01")).toBe("jan/26");
  });

  test("formata datas no padrão brasileiro", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  test("desloca meses atravessando a virada de ano", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", -12)).toBe("2025-10");
  });

  test("o mês atual tem o formato esperado", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  test("monta o primeiro dia do mês", () => {
    expect(firstDayOfMonth("2026-10")).toBe("2026-10-01");
  });
});

describe("percentuais", () => {
  test("mostra o sinal da variação", () => {
    expect(formatPercent(12.34)).toBe("+12,3%");
    expect(formatPercent(-8)).toBe("−8,0%");
    expect(formatPercent(0)).toBe("0,0%");
  });

  test("omite o sinal quando pedido, para participação no total", () => {
    expect(formatPercent(27.33, false)).toBe("27,3%");
  });
});
