import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  // jsdom não implementa matchMedia; o padrão aqui é "sistema em claro".
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

describe("ThemeToggle", () => {
  test("começa em 'sistema', respeitando a preferência do sistema operacional", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /seguir o sistema/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("escolher o tema escuro marca o documento e grava a preferência", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /tema escuro/i }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("finops-theme")).toBe("dark");
  });

  test("voltar ao tema claro remove a marca do documento", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /tema escuro/i }));
    await user.click(screen.getByRole("button", { name: /tema claro/i }));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("finops-theme")).toBe("light");
  });

  test("voltar para 'sistema' apaga a preferência gravada", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /tema escuro/i }));
    await user.click(screen.getByRole("button", { name: /seguir o sistema/i }));

    expect(localStorage.getItem("finops-theme")).toBeNull();
  });

  test("a preferência gravada é aplicada ao carregar", () => {
    localStorage.setItem("finops-theme", "dark");
    render(<ThemeToggle />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: /tema escuro/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
