import { expect, test } from "../playwright-fixture";

test.describe("Shell público — smoke sem credenciais", () => {
  test("exibe o login acessível e permite inspecionar a senha", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    const email = page.getByLabel(/e-mail/i);
    const password = page.getByLabel(/^senha/i);
    const passwordToggle = page.getByRole("button", { name: /mostrar senha/i });

    await expect(email).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await expect(page.getByRole("button", { name: /^entrar$/i })).toBeEnabled();

    await password.fill("senha-de-teste");
    await passwordToggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: /ocultar senha/i })).toBeVisible();
  });

  test("explica o encerramento por inatividade", async ({ page }) => {
    await page.goto("/auth?reason=idle_timeout", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/sessão foi encerrada por/i)).toBeVisible();
    await expect(page.getByText(/inatividade/i).first()).toBeVisible();
  });

  test("mantém uma saída navegável para rotas inexistentes", async ({ page }) => {
    await page.goto("/rota-que-nao-existe", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: /return to home/i })).toHaveAttribute("href", "/");
  });
});
