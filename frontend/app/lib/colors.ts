/**
 * Paleta de cores dos projetos.
 *
 * São os 8 slots da paleta categórica validada para daltonismo (ΔE adjacente
 * acima do piso nos modos claro e escuro) — ver docs/adr/004-design-system.md.
 * O projeto guarda o hex do modo claro; `seriesColor` traduz para o par do modo
 * escuro, de forma que a identidade visual do projeto não muda, só o brilho.
 */

export type ProjectColor = { light: string; dark: string; name: string };

export const projectColors: ProjectColor[] = [
  { light: "#2a78d6", dark: "#3987e5", name: "Azul" },
  { light: "#eb6834", dark: "#d95926", name: "Laranja" },
  { light: "#1baf7a", dark: "#199e70", name: "Esmeralda" },
  { light: "#eda100", dark: "#c98500", name: "Âmbar" },
  { light: "#e87ba4", dark: "#d55181", name: "Rosa" },
  { light: "#008300", dark: "#008300", name: "Verde" },
  { light: "#4a3aa7", dark: "#9085e9", name: "Violeta" },
  { light: "#e34948", dark: "#e66767", name: "Vermelho" },
];

const darkByLight = new Map(projectColors.map((c) => [c.light.toLowerCase(), c.dark]));

/** Devolve a cor a usar no modo atual. Cores fora da paleta passam inalteradas. */
export function seriesColor(hex: string, isDark: boolean): string {
  if (!isDark) return hex;
  return darkByLight.get(hex.toLowerCase()) ?? hex;
}

/** Cor padrão de um projeto novo, variando conforme quantos já existem. */
export function nextProjectColor(existingCount: number): string {
  return projectColors[existingCount % projectColors.length].light;
}
