import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { EvolutionPoint } from "~/lib/api";
import { CategoryBars, EvolutionChart, EvolutionTable, niceScale } from "./charts";

const points: EvolutionPoint[] = [
  {
    month: "2026-08",
    total_cents: 10000,
    projects: [{ project_id: "a", name: "Loja", color: "#2a78d6", total_cents: 10000 }],
  },
  {
    month: "2026-09",
    total_cents: 25000,
    projects: [
      { project_id: "a", name: "Loja", color: "#2a78d6", total_cents: 10000 },
      { project_id: "b", name: "App", color: "#eb6834", total_cents: 15000 },
    ],
  },
  {
    month: "2026-10",
    total_cents: 20000,
    projects: [{ project_id: "b", name: "App", color: "#eb6834", total_cents: 20000 }],
  },
];

describe("EvolutionChart", () => {
  test("rotula cada mês no eixo", () => {
    render(<EvolutionChart points={points} isDark={false} />);
    expect(screen.getByText("ago/26")).toBeInTheDocument();
    expect(screen.getByText("set/26")).toBeInTheDocument();
    expect(screen.getByText("out/26")).toBeInTheDocument();
  });

  test("mostra legenda quando há duas ou mais séries", () => {
    render(<EvolutionChart points={points} isDark={false} />);
    // Identidade nunca só pela cor: o nome do projeto aparece na legenda.
    expect(screen.getByText("Loja")).toBeInTheDocument();
    expect(screen.getByText("App")).toBeInTheDocument();
  });

  test("não mostra legenda no modo de série única", () => {
    render(<EvolutionChart points={points} isDark={false} mode="total" />);
    expect(screen.queryByText("Loja")).not.toBeInTheDocument();
  });

  test("hover revela o total do mês e a quebra por projeto", async () => {
    const user = userEvent.setup();
    render(<EvolutionChart points={points} isDark={false} />);

    await user.hover(screen.getByText("set/26"));

    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
  });

  test("tem descrição acessível em vez de ser só um desenho", () => {
    render(<EvolutionChart points={points} isDark={false} />);
    expect(screen.getByRole("img", { name: /empilhado por projeto/i })).toBeInTheDocument();
  });
});

describe("EvolutionTable", () => {
  test("mostra o total de cada mês e a variação sobre o anterior", () => {
    render(<EvolutionTable points={points} />);

    const rows = screen.getAllByRole("row").slice(1); // descarta o cabeçalho
    expect(rows).toHaveLength(3);

    // Primeiro mês não tem base de comparação.
    expect(rows[0]).toHaveTextContent("—");
    // Subiu de 100 para 250: +150.
    expect(rows[1]).toHaveTextContent("+R$ 150,00");
    // Caiu de 250 para 200: −50.
    expect(rows[2]).toHaveTextContent("−R$ 50,00");
  });

  test("indica explicitamente quando o mês não mudou", () => {
    const flat: EvolutionPoint[] = [
      { month: "2026-09", total_cents: 5000, projects: [] },
      { month: "2026-10", total_cents: 5000, projects: [] },
    ];
    render(<EvolutionTable points={flat} />);
    expect(screen.getByText("sem mudança")).toBeInTheDocument();
  });
});

describe("CategoryBars", () => {
  test("traduz a categoria e mostra o valor ao lado da barra", () => {
    render(
      <CategoryBars
        categories={[
          { category: "banco", total_cents: 7900 },
          { category: "dominio", total_cents: 333 },
        ]}
      />,
    );
    expect(screen.getByText("Banco de dados")).toBeInTheDocument();
    expect(screen.getByText("Domínio")).toBeInTheDocument();
    expect(screen.getByText("R$ 79,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 3,33")).toBeInTheDocument();
  });

  test("categoria desconhecida aparece com o próprio nome", () => {
    render(<CategoryBars categories={[{ category: "foguete", total_cents: 100 }]} />);
    expect(screen.getByText("foguete")).toBeInTheDocument();
  });
});

describe("niceScale", () => {
  test("arredonda o teto do eixo para um passo redondo", () => {
    // R$ 578,74 vira uma escala de 0 a R$ 600, de R$ 200 em R$ 200.
    expect(niceScale(57874)).toEqual({ max: 60000, values: [0, 20000, 40000, 60000] });
  });

  test("funciona em ordens de grandeza diferentes", () => {
    expect(niceScale(2490).values).toEqual([0, 1000, 2000, 3000]);
    expect(niceScale(1234567).max % 100000).toBe(0);
  });

  test("o maior valor sempre cabe dentro do eixo", () => {
    for (const value of [1, 99, 2490, 57874, 123456, 9_999_999]) {
      expect(niceScale(value).max).toBeGreaterThanOrEqual(value);
    }
  });

  test("escala degenerada não quebra", () => {
    expect(niceScale(0)).toEqual({ max: 1, values: [0, 1] });
  });
});
