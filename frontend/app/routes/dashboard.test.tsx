import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Dashboard, EvolutionPoint } from "~/lib/api";
import DashboardPage from "./dashboard";

vi.mock("~/lib/api", () => ({
  api: {
    me: vi.fn(),
    dashboard: vi.fn(),
    listProjects: vi.fn(),
    evolution: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
  },
}));

const { api } = await import("~/lib/api");

const projectA = "11111111-1111-1111-1111-111111111111";
const projectB = "22222222-2222-2222-2222-222222222222";

const dashboard: Dashboard = {
  month: "2026-10",
  total_cents: 55400,
  previous_total_cents: 50000,
  delta_cents: 5400,
  delta_percent: 10.8,
  projects: [
    {
      project_id: projectA,
      name: "App de Receitas",
      color: "#1baf7a",
      total_cents: 39500,
      share_percent: 71.3,
      service_count: 2,
      missing_rate: false,
    },
    {
      project_id: projectB,
      name: "Blog Pessoal",
      color: "#eb6834",
      total_cents: 15900,
      share_percent: 28.7,
      service_count: 1,
      missing_rate: false,
    },
  ],
  missing_currencies: [],
};

// Série de três meses. Os valores de setembro são escolhidos para que a variação
// do total (+R$ 54,00) seja diferente da de cada projeto — assim um teste não
// passa por coincidência ao encontrar o número errado na tela.
const evolution: EvolutionPoint[] = [
  {
    month: "2026-08",
    total_cents: 50000,
    projects: [
      { project_id: projectA, name: "App de Receitas", color: "#1baf7a", total_cents: 34100 },
      { project_id: projectB, name: "Blog Pessoal", color: "#eb6834", total_cents: 15900 },
    ],
  },
  {
    month: "2026-09",
    total_cents: 50000,
    projects: [
      { project_id: projectA, name: "App de Receitas", color: "#1baf7a", total_cents: 33000 },
      { project_id: projectB, name: "Blog Pessoal", color: "#eb6834", total_cents: 17000 },
    ],
  },
  {
    month: "2026-10",
    total_cents: 55400,
    projects: [
      { project_id: projectA, name: "App de Receitas", color: "#1baf7a", total_cents: 39500 },
      { project_id: projectB, name: "Blog Pessoal", color: "#eb6834", total_cents: 15900 },
    ],
  },
];

function renderDashboard() {
  const Stub = createRoutesStub([
    { path: "/", Component: DashboardPage },
    { path: "/projetos/:id", Component: () => <p>Tela do projeto</p> },
    { path: "/evolucao", Component: () => <p>Tela de evolução</p> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Localiza o cartão de um projeto pelo título. */
function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole("link", { name });
  const card = heading.closest("section");
  if (!card) throw new Error(`cartão de ${name} não encontrado`);
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.me).mockResolvedValue({ id: "u1", email: "eu@exemplo.com" });
  vi.mocked(api.dashboard).mockResolvedValue(dashboard);
  vi.mocked(api.listProjects).mockResolvedValue([
    { id: projectA, name: "App de Receitas", description: "", color: "#1baf7a", archived: false },
    { id: projectB, name: "Blog Pessoal", description: "", color: "#eb6834", archived: false },
  ]);
  vi.mocked(api.evolution).mockResolvedValue({ months: evolution });
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

describe("painel do mês", () => {
  test("mostra o total do mês e a variação sobre o anterior", async () => {
    renderDashboard();
    // O título já existe antes dos dados chegarem (mostrando "—"), então a
    // espera é pelo valor em si.
    expect(await screen.findByText("R$ 554,00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("R$ 554,00");
    expect(screen.getByText(/\+R\$ 54,00/)).toBeInTheDocument();
    expect(screen.getByText(/\+10,8%/)).toBeInTheDocument();
  });

  test("há um cartão por projeto, com total e participação", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "App de Receitas" });

    const app = cardFor("App de Receitas");
    expect(within(app).getByText("R$ 395,00")).toBeInTheDocument();
    expect(within(app).getByText("71,3% do total")).toBeInTheDocument();
    expect(within(app).getByText(/2 serviços/)).toBeInTheDocument();

    const blog = cardFor("Blog Pessoal");
    expect(within(blog).getByText("R$ 159,00")).toBeInTheDocument();
    expect(within(blog).getByText(/1 serviço/)).toBeInTheDocument();
  });

  test("cada cartão traz a variação do próprio projeto, não a do total", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "App de Receitas" });

    // O total subiu R$ 54,00, mas o App subiu R$ 65,00 e o Blog caiu R$ 11,00.
    const app = within(cardFor("App de Receitas")).getByText("+R$ 65,00");
    expect(app).toHaveClass("text-alert"); // custo subindo é ruim

    const blog = within(cardFor("Blog Pessoal")).getByText("−R$ 11,00");
    expect(blog).toHaveClass("text-good"); // custo caindo é bom
  });

  test("projeto com o mesmo valor nos dois meses mostra 'sem mudança'", async () => {
    vi.mocked(api.evolution).mockResolvedValue({
      months: evolution.map((point) => ({
        ...point,
        projects: point.projects.map((project) =>
          project.project_id === projectB ? { ...project, total_cents: 15900 } : project,
        ),
      })),
    });
    renderDashboard();
    await screen.findByRole("link", { name: "Blog Pessoal" });

    expect(
      within(cardFor("Blog Pessoal")).getByText(/sem mudança sobre o mês anterior/),
    ).toBeInTheDocument();
  });

  test("cada cartão desenha o gráfico de evolução do seu projeto", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "App de Receitas" });

    for (const name of ["App de Receitas", "Blog Pessoal"]) {
      const chart = within(cardFor(name)).getByRole("img", { name: /mês a mês/i });
      expect(chart).toBeInTheDocument();
      // Três meses na série, rotulados no eixo.
      expect(within(cardFor(name)).getByText("out/26")).toBeInTheDocument();
    }
  });

  test("o nome do projeto leva para a tela de detalhe", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("link", { name: "App de Receitas" }));
    expect(await screen.findByText("Tela do projeto")).toBeInTheDocument();
  });

  test("alternar a escala troca a explicação mostrada ao usuário", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("link", { name: "App de Receitas" });

    // A escala comparável é o padrão.
    expect(screen.getByRole("button", { name: "Comparável" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/podem ser comparadas entre projetos/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Própria" }));

    expect(screen.getByRole("button", { name: "Própria" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/não podem ser comparadas entre si/i)).toBeInTheDocument();
  });

  test("avisa quando há serviços sem cotação cadastrada", async () => {
    vi.mocked(api.dashboard).mockResolvedValue({ ...dashboard, missing_currencies: ["USD"] });
    renderDashboard();

    expect(await screen.findByText(/sem cotação cadastrada/i)).toBeInTheDocument();
  });

  test("sem projetos, convida a criar o primeiro", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.dashboard).mockResolvedValue({
      ...dashboard,
      total_cents: 0,
      previous_total_cents: 0,
      delta_cents: 0,
      delta_percent: null,
      projects: [],
    });
    vi.mocked(api.evolution).mockResolvedValue({ months: [] });
    renderDashboard();

    expect(await screen.findByText(/comece pelo primeiro projeto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar projeto/i })).toBeInTheDocument();
  });

  test("com projetos mas nenhum custo no mês, explica o vazio", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([
      { id: projectA, name: "App de Receitas", description: "", color: "#1baf7a", archived: false },
    ]);
    vi.mocked(api.dashboard).mockResolvedValue({
      ...dashboard,
      total_cents: 0,
      previous_total_cents: 0,
      delta_cents: 0,
      delta_percent: null,
      projects: [],
    });
    vi.mocked(api.evolution).mockResolvedValue({ months: [] });
    renderDashboard();

    expect(await screen.findByText(/nenhum custo neste mês/i)).toBeInTheDocument();
  });

  test("navegar entre meses recarrega os dados daquele mês", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("link", { name: "App de Receitas" });

    const monthBefore = vi.mocked(api.dashboard).mock.calls.at(-1)?.[0];
    await user.click(screen.getByRole("button", { name: /mês anterior/i }));

    const monthAfter = vi.mocked(api.dashboard).mock.calls.at(-1)?.[0];
    expect(monthAfter).not.toBe(monthBefore);
    expect(vi.mocked(api.evolution).mock.calls.at(-1)?.[0]).toBe(monthAfter);
  });
});
