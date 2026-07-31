import { expect, test } from "../playwright-fixture";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const organizationId = process.env.E2E_ORGANIZATION_ID;
const hasCredentials = Boolean(email && password && organizationId);

test.describe("OKR V2 — fechamento completo do ciclo", () => {
  test.skip(
    !hasCredentials,
    "Defina E2E_USER_EMAIL, E2E_USER_PASSWORD e E2E_ORGANIZATION_ID.",
  );

  test("planeja, executa, revisa, transporta e encerra um ciclo", async ({
    page,
  }) => {
    const runId = Date.now().toString();
    const sourceCode = `E2E-${runId}`;
    const targetCode = `E2E-NEXT-${runId}`;
    const objectiveTitle = `Objective E2E ${runId}`;
    const krTitle = `KR E2E ${runId}`;
    const initiativeTitle = `Iniciativa E2E ${runId}`;

    await page.addInitScript((orgId) => {
      window.localStorage.setItem("selectedOrganizationId", orgId);
    }, organizationId!);

    await page.goto("/auth");
    await page.getByLabel(/e-mail/i).fill(email!);
    await page.getByLabel(/senha/i).fill(password!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).not.toHaveURL(/\/auth/);

    await page.goto("/okr/ciclos");
    await createCycle(page, {
      code: targetCode,
      name: `Ciclo destino ${runId}`,
      startsAt: "2027-04-01",
      endsAt: "2027-06-30",
    });
    await createCycle(page, {
      code: sourceCode,
      name: `Ciclo origem ${runId}`,
      startsAt: "2027-01-01",
      endsAt: "2027-03-31",
    });

    const sourceCard = page.locator("article, [data-testid], .rounded-lg")
      .filter({ hasText: sourceCode })
      .first();
    await expect(sourceCard).toBeVisible();
    await sourceCard.getByRole("button", { name: "Publicar" }).click();

    await page.goto("/okr/objectives");
    await page.getByRole("button", { name: "+ Novo objective" }).click();
    const objectiveDialog = page.getByRole("dialog", { name: "Novo objective" });
    await chooseRadixOption(objectiveDialog.getByText("Selecione um ciclo aberto"), sourceCode);
    await objectiveDialog.getByLabel("Título").fill(objectiveTitle);
    await objectiveDialog.getByLabel("Descrição").fill("Fluxo E2E de encerramento integral.");
    await objectiveDialog.getByRole("button", { name: "Criar" }).click();

    const objectiveCard = page.locator("article, [data-testid], .rounded-lg")
      .filter({ hasText: objectiveTitle })
      .first();
    await expect(objectiveCard).toBeVisible();
    await objectiveCard.getByRole("button", { name: "Key Results" }).click();

    const krDialog = page.getByRole("dialog", { name: new RegExp(`Key Results.*${escapeRegExp(objectiveTitle)}`) });
    await krDialog.getByLabel("Título").fill(krTitle);
    await krDialog.getByLabel("Baseline").first().fill("0");
    await krDialog.getByLabel("Atual").first().fill("100");
    await krDialog.getByLabel("Meta").fill("100");
    await krDialog.getByRole("button", { name: "Adicionar KR" }).click();
    await expect(krDialog.getByText(krTitle)).toBeVisible();
    await krDialog.getByRole("button", { name: "Fechar" }).click();

    await objectiveCard.getByRole("button", { name: "Publicar" }).click();
    await objectiveCard.getByRole("button", { name: "Iniciativas" }).click();
    const initiativeDialog = page.getByRole("dialog", {
      name: new RegExp(`Iniciativas.*${escapeRegExp(objectiveTitle)}`),
    });
    await initiativeDialog.getByLabel("Título").fill(initiativeTitle);
    await initiativeDialog.getByRole("button", { name: /adicionar|criar/i }).click();
    await expect(initiativeDialog.getByText(initiativeTitle)).toBeVisible();
    await initiativeDialog.getByRole("button", { name: "Fechar" }).click();

    await objectiveCard.getByRole("button", { name: "Review" }).click();
    const reviewDialog = page.getByRole("dialog", {
      name: new RegExp(`Review.*${escapeRegExp(objectiveTitle)}`),
    });
    await reviewDialog.getByLabel("Resumo do resultado *").fill("Resultado validado pelo E2E.");
    await reviewDialog.getByLabel("Lições aprendidas").fill("Manter cadência e evidências.");
    await reviewDialog.getByRole("button", { name: "Enviar review" }).click();
    await reviewDialog.getByRole("button", { name: "Aprovar", exact: true }).click();

    await chooseRadixOption(
      reviewDialog.getByText("Selecione", { exact: true }),
      targetCode,
    );
    await reviewDialog.getByPlaceholder("Motivo do carry-forward").fill(
      "Continuidade aprovada no encerramento E2E.",
    );
    await reviewDialog.getByRole("button", { name: "Transferir objective" }).click();
    await expect(page.getByText(/objective transferido/i)).toBeVisible();
    await reviewDialog.getByRole("button", { name: "Fechar" }).click();

    await page.goto("/okr/ciclos");
    const refreshedSourceCard = page.locator("article, [data-testid], .rounded-lg")
      .filter({ hasText: sourceCode })
      .first();
    await refreshedSourceCard.getByRole("button", { name: /iniciar fechamento/i }).click();

    await page.goto("/okr/objectives");
    const cycleReview = page.getByText("Review do ciclo").locator("..").locator("..");
    await cycleReview.getByLabel("Principais conquistas").fill("Ciclo E2E concluído.");
    await cycleReview.getByLabel("Lições aprendidas").fill("Fluxo integral validado.");
    await cycleReview.getByRole("button", { name: "Consolidar review" }).click();
    await cycleReview.getByRole("button", { name: "Aprovar e encerrar ciclo" }).click();
    await expect(page.getByText(/ciclo aprovado e encerrado/i)).toBeVisible();
  });
});

async function createCycle(
  page: import("@playwright/test").Page,
  input: { code: string; name: string; startsAt: string; endsAt: string },
) {
  await page.getByRole("button", { name: "+ Novo ciclo" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo ciclo" });
  await dialog.getByLabel("Código *").fill(input.code);
  await dialog.getByLabel("Nome *").fill(input.name);
  await dialog.getByLabel("Início *").fill(input.startsAt);
  await dialog.getByLabel("Fim *").fill(input.endsAt);
  await dialog.getByRole("button", { name: "Criar ciclo" }).click();
  await expect(page.getByText(input.code)).toBeVisible();
}

async function chooseRadixOption(
  trigger: import("@playwright/test").Locator,
  optionText: string,
) {
  await trigger.click();
  await trigger.page().getByRole("option", { name: new RegExp(escapeRegExp(optionText)) }).click();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
