import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Login from "./login";

vi.mock("~/lib/api", () => ({
  api: {
    me: vi.fn(() => Promise.reject(new Error("sem sessão"))),
    login: vi.fn(() => Promise.resolve({ id: "1", email: "a@b.com" })),
    register: vi.fn(() => Promise.resolve({ id: "1", email: "a@b.com" })),
  },
}));

const { api } = await import("~/lib/api");

function renderLogin() {
  const Stub = createRoutesStub([
    { path: "/entrar", Component: Login },
    { path: "/", Component: () => <p>Painel</p> },
  ]);
  return render(<Stub initialEntries={["/entrar"]} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.me).mockRejectedValue(new Error("sem sessão"));
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

describe("tela de login", () => {
  test("começa no modo de entrada", async () => {
    renderLogin();
    expect(await screen.findByRole("heading", { name: "Entrar", level: 2 })).toBeInTheDocument();
  });

  test("autentica com e-mail e senha e vai para o painel", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/e-mail/i), "eu@exemplo.com");
    await user.type(screen.getByLabelText(/senha/i), "senha-muito-boa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(api.login).toHaveBeenCalledWith("eu@exemplo.com", "senha-muito-boa");
    expect(await screen.findByText("Painel")).toBeInTheDocument();
  });

  test("alterna para o cadastro e usa a API de registro", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole("button", { name: /criar uma agora/i }));
    expect(screen.getByRole("heading", { name: "Criar conta", level: 2 })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/e-mail/i), "novo@exemplo.com");
    await user.type(screen.getByLabelText(/senha/i), "senha-muito-boa");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(api.register).toHaveBeenCalledWith("novo@exemplo.com", "senha-muito-boa");
    expect(api.login).not.toHaveBeenCalled();
  });

  test("mostra o erro devolvido pela API", async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error("e-mail ou senha incorretos"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/e-mail/i), "eu@exemplo.com");
    await user.type(screen.getByLabelText(/senha/i), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("e-mail ou senha incorretos")).toBeInTheDocument();
  });

  test("quem já tem sessão é levado direto ao painel", async () => {
    vi.mocked(api.me).mockResolvedValue({ id: "1", email: "a@b.com" });
    renderLogin();

    expect(await screen.findByText("Painel")).toBeInTheDocument();
  });
});
