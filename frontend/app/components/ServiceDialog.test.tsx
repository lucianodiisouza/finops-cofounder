import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ServiceDialog } from "./ServiceDialog";

vi.mock("~/lib/api", () => ({
  api: {
    createService: vi.fn(() => Promise.resolve({})),
    updateService: vi.fn(() => Promise.resolve({})),
  },
}));

const { api } = await import("~/lib/api");

const baseProps = {
  open: true,
  projectId: "projeto-1",
  month: "2026-10",
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ServiceDialog", () => {
  test("não renderiza nada quando fechado", () => {
    render(<ServiceDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("sugere o primeiro dia do mês em exibição como início", () => {
    render(<ServiceDialog {...baseProps} />);
    expect(screen.getByLabelText(/início da cobrança/i)).toHaveValue("2026-10-01");
  });

  test("converte o valor digitado em centavos ao salvar", async () => {
    const user = userEvent.setup();
    render(<ServiceDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/nome do serviço/i), "VPS Hetzner");
    await user.type(screen.getByLabelText(/^valor$/i), "79,90");
    await user.selectOptions(screen.getByLabelText(/moeda/i), "EUR");
    await user.selectOptions(screen.getByLabelText(/categoria/i), "servidor");
    await user.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(api.createService).toHaveBeenCalledWith(
      "projeto-1",
      expect.objectContaining({
        name: "VPS Hetzner",
        amount_cents: 7990,
        currency: "EUR",
        billing_cycle: "monthly",
        starts_on: "2026-10-01",
        ends_on: null,
      }),
    );
    expect(baseProps.onSaved).toHaveBeenCalled();
  });

  test("recusa valor inválido sem chamar a API", async () => {
    const user = userEvent.setup();
    render(<ServiceDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/nome do serviço/i), "Serviço");
    await user.type(screen.getByLabelText(/^valor$/i), "abc");
    await user.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(await screen.findByText(/informe um valor válido/i)).toBeInTheDocument();
    expect(api.createService).not.toHaveBeenCalled();
  });

  test("explica o rateio quando o ciclo é anual", async () => {
    const user = userEvent.setup();
    render(<ServiceDialog {...baseProps} />);

    await user.selectOptions(screen.getByLabelText(/ciclo/i), "yearly");
    expect(screen.getByText(/dividido por 12/i)).toBeInTheDocument();
  });

  test("ao editar, preenche os campos com o serviço existente", () => {
    render(
      <ServiceDialog
        {...baseProps}
        service={{
          id: "servico-1",
          project_id: "projeto-1",
          name: "Postgres gerenciado",
          category: "banco",
          amount_cents: 7900,
          currency: "BRL",
          billing_cycle: "monthly",
          starts_on: "2025-03-01",
          ends_on: "2026-12-31",
          notes: "conta pessoal",
        }}
      />,
    );

    expect(screen.getByLabelText(/nome do serviço/i)).toHaveValue("Postgres gerenciado");
    expect(screen.getByLabelText(/^valor$/i)).toHaveValue("79,00");
    expect(screen.getByLabelText(/término/i)).toHaveValue("2026-12-31");
    expect(screen.getByLabelText(/observações/i)).toHaveValue("conta pessoal");
  });

  test("usa a API de atualização ao editar, não a de criação", async () => {
    const user = userEvent.setup();
    render(
      <ServiceDialog
        {...baseProps}
        service={{
          id: "servico-1",
          project_id: "projeto-1",
          name: "Postgres",
          category: "banco",
          amount_cents: 7900,
          currency: "BRL",
          billing_cycle: "monthly",
          starts_on: "2025-03-01",
          ends_on: null,
          notes: "",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(api.updateService).toHaveBeenCalledWith("servico-1", expect.anything());
    expect(api.createService).not.toHaveBeenCalled();
  });

  test("mostra a mensagem de erro devolvida pela API", async () => {
    vi.mocked(api.createService).mockRejectedValueOnce(new Error("categoria inválida"));
    const user = userEvent.setup();
    render(<ServiceDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/nome do serviço/i), "Serviço");
    await user.type(screen.getByLabelText(/^valor$/i), "10");
    await user.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(await screen.findByText("categoria inválida")).toBeInTheDocument();
  });
});
