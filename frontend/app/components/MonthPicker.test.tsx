import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { currentMonth } from "~/lib/format";
import { MonthPicker } from "./MonthPicker";

describe("MonthPicker", () => {
  test("mostra o mês por extenso", () => {
    render(<MonthPicker month="2026-10" onChange={() => {}} />);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
  });

  test("as setas avançam e voltam um mês", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MonthPicker month="2026-10" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /mês anterior/i }));
    expect(onChange).toHaveBeenLastCalledWith("2026-09");

    await user.click(screen.getByRole("button", { name: /mês seguinte/i }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11");
  });

  test("o atalho para o mês atual só aparece quando se está em outro mês", () => {
    // Mês fixo no passado: nunca coincide com o mês atual, qualquer que seja a data do teste.
    const { rerender } = render(<MonthPicker month="2020-01" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /mês atual/i })).toBeInTheDocument();

    rerender(<MonthPicker month={currentMonth()} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /mês atual/i })).not.toBeInTheDocument();
  });

  test("o atalho volta para o mês atual", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MonthPicker month="2020-01" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /mês atual/i }));
    expect(onChange).toHaveBeenCalledWith(currentMonth());
  });
});
