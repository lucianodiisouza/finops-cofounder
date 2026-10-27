import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Dialog, Field, Input } from "./ui";

describe("Dialog", () => {
  test("não renderiza nada quando fechado", () => {
    render(
      <Dialog open={false} title="Título" onClose={() => {}}>
        conteúdo
      </Dialog>,
    );
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  test("a tecla Esc fecha o diálogo", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open title="Novo serviço" onClose={onClose}>
        conteúdo
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  test("o botão de fechar chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open title="Novo serviço" onClose={onClose}>
        conteúdo
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test("é anunciado como diálogo modal com o próprio título", () => {
    render(
      <Dialog open title="Novo serviço" onClose={() => {}}>
        conteúdo
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Novo serviço" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

describe("Field", () => {
  test("o nome acessível do campo é só o rótulo, sem a dica", () => {
    render(
      <Field label="Valor" hint="Use vírgula para os centavos.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Valor")).toBeInTheDocument();
  });

  test("a dica é ligada ao campo por aria-describedby", () => {
    render(
      <Field label="Valor" hint="Use vírgula para os centavos.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Valor")).toHaveAccessibleDescription(
      "Use vírgula para os centavos.",
    );
  });

  test("o erro substitui a dica na descrição do campo", () => {
    render(
      <Field label="Valor" hint="Use vírgula." error="Valor inválido.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Valor")).toHaveAccessibleDescription("Valor inválido.");
    expect(screen.queryByText("Use vírgula.")).not.toBeInTheDocument();
  });
});
