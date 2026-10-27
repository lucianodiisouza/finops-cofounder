import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { projectColors } from "~/lib/colors";
import { ProjectDialog } from "./ProjectDialog";

vi.mock("~/lib/api", () => ({
  api: {
    createProject: vi.fn((body) => Promise.resolve({ id: "novo", archived: false, ...body })),
    updateProject: vi.fn((id, body) => Promise.resolve({ id, archived: false, ...body })),
  },
}));

const { api } = await import("~/lib/api");

const baseProps = {
  open: true,
  existingCount: 0,
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProjectDialog", () => {
  test("cria um projeto com nome, descrição e cor", async () => {
    const user = userEvent.setup();
    render(<ProjectDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/nome do projeto/i), "Loja Online");
    await user.type(screen.getByLabelText(/descrição/i), "E-commerce");
    await user.click(screen.getByRole("button", { name: projectColors[2].name }));
    await user.click(screen.getByRole("button", { name: /salvar projeto/i }));

    expect(api.createProject).toHaveBeenCalledWith({
      name: "Loja Online",
      description: "E-commerce",
      color: projectColors[2].light,
    });
    expect(baseProps.onSaved).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  test("sugere uma cor diferente conforme o número de projetos existentes", () => {
    render(<ProjectDialog {...baseProps} existingCount={3} />);
    expect(screen.getByRole("button", { name: projectColors[3].name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("ao editar, preenche os campos e usa a API de atualização", async () => {
    const user = userEvent.setup();
    render(
      <ProjectDialog
        {...baseProps}
        project={{
          id: "projeto-1",
          name: "Blog Pessoal",
          description: "Meu blog",
          color: projectColors[5].light,
          archived: false,
        }}
      />,
    );

    expect(screen.getByLabelText(/nome do projeto/i)).toHaveValue("Blog Pessoal");
    expect(screen.getByRole("button", { name: projectColors[5].name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /salvar projeto/i }));
    expect(api.updateProject).toHaveBeenCalledWith("projeto-1", expect.anything());
    expect(api.createProject).not.toHaveBeenCalled();
  });

  test("mostra a mensagem de erro devolvida pela API", async () => {
    vi.mocked(api.createProject).mockRejectedValueOnce(new Error("este nome já existe"));
    const user = userEvent.setup();
    render(<ProjectDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/nome do projeto/i), "X");
    await user.click(screen.getByRole("button", { name: /salvar projeto/i }));

    expect(await screen.findByText("este nome já existe")).toBeInTheDocument();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  test("cancelar fecha sem salvar", async () => {
    const user = userEvent.setup();
    render(<ProjectDialog {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(baseProps.onClose).toHaveBeenCalled();
    expect(api.createProject).not.toHaveBeenCalled();
  });
});
