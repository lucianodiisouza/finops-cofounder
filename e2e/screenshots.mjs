/**
 * Verificação visual: autentica pelo endpoint de desenvolvimento e fotografa
 * as telas principais nos dois temas, em desktop e celular.
 *
 * Uso: node screenshots.mjs [baseURL]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.argv[2] ?? "http://localhost:5173";
const outDir = new URL("./screenshots/", import.meta.url).pathname;

const pages = [
  { name: "painel", path: "/" },
  { name: "evolucao", path: "/evolucao" },
  { name: "cotacoes", path: "/cotacoes" },
];

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * Espera a tela sair do estado de carregamento. Só `networkidle` não basta:
 * a busca da sessão e dos dados acontece depois que a navegação do SPA termina.
 */
async function waitReady(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Carregando"),
    null,
    { timeout: 15000 },
  );
}

/**
 * O corpo da página nunca deve rolar na horizontal. Tabelas e gráficos largos
 * rolam dentro do próprio contêiner; se vazarem, a tela toda desloca no celular.
 */
async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  if (overflow.scroll > overflow.client + 1) {
    throw new Error(
      `${label}: a página rola na horizontal (${overflow.scroll}px de conteúdo em ${overflow.client}px de tela)`,
    );
  }
}

await mkdir(outDir, { recursive: true });
// --lang força o idioma dos controles nativos (seletor de mês e de data), que
// seguem o idioma do navegador — sem isso as capturas saem em inglês.
const browser = await chromium.launch({ args: ["--lang=pt-BR"] });

try {
  for (const theme of ["light", "dark"]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: "pt-BR",
        // Sem isso a captura pega a animação de entrada no meio e a tela sai em branco.
        reducedMotion: "reduce",
      });
      const page = await context.newPage();

      // Sessão de desenvolvimento: dispensa o fluxo real de login.
      await page.goto(baseURL);
      const response = await page.request.post(`${baseURL}/api/dev/login`, {
        data: { email: "dev@finops.local" },
      });
      if (!response.ok()) {
        throw new Error(`login de desenvolvimento falhou: ${response.status()}`);
      }
      await page.addInitScript(
        (value) => localStorage.setItem("finops-theme", value),
        theme,
      );

      // Tela de login, antes de usar a sessão.
      if (theme === "light") {
        const anon = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: "pt-BR",
          reducedMotion: "reduce",
        });
        const anonPage = await anon.newPage();
        await anonPage.goto(`${baseURL}/entrar`);
        await waitReady(anonPage);
        await anonPage.screenshot({
          path: `${outDir}login-${viewport.name}.png`,
          fullPage: true,
        });
        await anon.close();
      }

      for (const target of pages) {
        await page.goto(`${baseURL}${target.path}`);
        await waitReady(page);
        await assertNoHorizontalScroll(page, `${target.name}/${viewport.name}/${theme}`);
        await page.screenshot({
          path: `${outDir}${target.name}-${viewport.name}-${theme}.png`,
          fullPage: true,
        });
      }

      // Detalhe do projeto: segue o primeiro item da lista do painel.
      await page.goto(baseURL);
      await waitReady(page);
      const firstProject = page.locator('a[href^="/projetos/"]').first();
      if (await firstProject.count()) {
        await firstProject.click();
        // A navegação é do lado do cliente: esperar o load não basta, é preciso
        // aguardar a URL mudar e o conteúdo do projeto aparecer.
        await page.waitForURL(/\/projetos\//);
        // Esperar só pelo sumiço de "Carregando" seria uma corrida: logo após o
        // clique o painel antigo ainda está na tela. A espera é pelo conteúdo
        // que só a tela de projeto tem.
        await page.getByText("Serviços vigentes em", { exact: false }).waitFor();
        await waitReady(page);
        await assertNoHorizontalScroll(page, `projeto/${viewport.name}/${theme}`);
        await page.screenshot({
          path: `${outDir}projeto-${viewport.name}-${theme}.png`,
          fullPage: true,
        });
      }

      await context.close();
    }
  }
  console.log(`capturas salvas em ${outDir}`);
} finally {
  await browser.close();
}
