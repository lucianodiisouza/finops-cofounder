import { describe, expect, test } from "vitest";
import { nextProjectColor, projectColors, seriesColor } from "./colors";

describe("cores de projeto", () => {
  test("no modo claro a cor é usada como está", () => {
    expect(seriesColor("#2a78d6", false)).toBe("#2a78d6");
  });

  test("no modo escuro usa o par mais claro da paleta", () => {
    expect(seriesColor("#2a78d6", true)).toBe("#3987e5");
    expect(seriesColor("#4a3aa7", true)).toBe("#9085e9");
  });

  test("aceita o hex em maiúsculas", () => {
    expect(seriesColor("#2A78D6", true)).toBe("#3987e5");
  });

  test("cor fora da paleta passa inalterada em vez de quebrar", () => {
    expect(seriesColor("#123456", true)).toBe("#123456");
  });

  test("a cor sugerida circula pela paleta", () => {
    expect(nextProjectColor(0)).toBe(projectColors[0].light);
    expect(nextProjectColor(3)).toBe(projectColors[3].light);
    expect(nextProjectColor(projectColors.length)).toBe(projectColors[0].light);
  });
});
