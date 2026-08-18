import { expect, test } from "../playwright-fixture";
const email = process.env.E2E_USER_EMAIL,
  password = process.env.E2E_USER_PASSWORD,
  organizationId = process.env.E2E_ORGANIZATION_ID;
test.describe("Dossiê APF por Impacto", () => {
  test.skip(
    !(email && password && organizationId),
    "Defina as credenciais e a organização E2E.",
  );
  test("carrega o workspace operacional e consulta somente a organização selecionada", async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (
        (response.url().includes("/rest/v1/apf_") ||
          response.url().includes("/rest/v1/rpc/get_apf")) &&
        !response.ok()
      )
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.addInitScript(
      (org) => localStorage.setItem("selectedOrganizationId", org),
      organizationId!,
    );
    await page.goto("/auth");
    await page.getByLabel(/e-mail/i).fill(email!);
    await page.getByRole("textbox", { name: /^senha/i }).fill(password!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"));
    await page.goto("/sala-agil/medicao-evidencias", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: /medição.*evidências/i }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /dossiês apf/i }).click();
    await expect(
      page.getByRole("heading", { name: /dossiê apf por impacto/i }),
    ).toBeVisible();
    for (const step of [
      "Visão geral",
      "Especificação",
      "Evidências",
      "Rastreabilidade",
      "Contagem",
      "Auditoria",
      "Documento",
    ])
      await expect(page.getByText(step, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /novo dossiê/i }),
    ).toBeVisible();
    expect(failures).toEqual([]);
  });
});
