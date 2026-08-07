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
    page.setDefaultTimeout(20_000);
    const authenticationResponses: string[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        /\/auth\/v\d+\/token/.test(url.pathname) ||
        url.pathname.includes("auth-rate-limiter")
      ) {
        authenticationResponses.push(
          `${url.hostname}${url.pathname}:${response.status()}`,
        );
      }
    });

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
    const emailField = page.getByLabel(/e-mail/i);
    const passwordField = page.getByRole("textbox", { name: /^senha/i });
    await emailField.fill(email!);
    await passwordField.fill(password!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await Promise.race([
      page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
        timeout: 15_000,
      }).catch(() => undefined),
      page.waitForTimeout(15_000),
    ]);

    if (new URL(page.url()).pathname.startsWith("/auth")) {
      const notifications = await page
        .locator("[data-sonner-toast]")
        .allTextContents();
      await emailField.fill("");
      await passwordField.fill("");
      throw new Error(
        `Login did not transition. Responses: ${authenticationResponses.join(", ") || "none"}. Notifications: ${notifications.join(" | ") || "none"}.`,
      );
    }

    await page.goto("/okr/ciclos");
    await dismissOnboarding(page);
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

    const sourceCard = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: sourceCode, exact: true }),
    });
    await expect(sourceCard).toBeVisible();
    await sourceCard.getByRole("button", { name: "Publicar" }).click();

    await page.goto("/okr/objectives");
    const createObjectiveButton = page.getByRole("button", {
      name: /novo obje(?:tivo|ctive)/i,
    });
    await expect(createObjectiveButton).toBeVisible();
    await createObjectiveButton.click();
    const objectiveDialog = page.getByRole("dialog", {
      name: /novo obje(?:tivo|ctive)/i,
    });
    await chooseRadixOption(objectiveDialog.getByText("Selecione um ciclo aberto"), sourceCode);
    await objectiveDialog
      .getByPlaceholder(/reduzir tempo de resposta/i)
      .fill(objectiveTitle);
    await objectiveDialog
      .locator("textarea")
      .first()
      .fill("Fluxo E2E de encerramento integral.");
    await chooseRadixOption(
      objectiveDialog.getByRole("combobox").nth(1),
      "Organizacional",
    );
    const objectiveCreateResponse = page.waitForResponse(
      (response) => response.url().includes("/rpc/create_okr_objective_v2"),
    );
    await objectiveDialog.getByRole("button", { name: "Criar" }).click();
    const createResponse = await objectiveCreateResponse;
    if (!createResponse.ok()) {
      const responseBody = (await createResponse.text()).slice(0, 600);
      throw new Error(
        `create_okr_objective_v2 failed with HTTP ${createResponse.status()}: ${responseBody}`,
      );
    }

    const objectiveCard = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: objectiveTitle, exact: true }),
    });
    await expect(objectiveCard).toBeVisible();
    await objectiveCard.getByRole("button", { name: "Key Results" }).click();

    const krDialog = page.getByRole("dialog", { name: new RegExp(`Key Results.*${escapeRegExp(objectiveTitle)}`) });
    await krDialog.getByPlaceholder(/reduzir mttr/i).fill(krTitle);
    const krNumericFields = krDialog.locator('input[type="number"]');
    await krNumericFields.nth(1).fill("0");
    await krNumericFields.nth(2).fill("100");
    await krNumericFields.nth(3).fill("100");
    await krDialog.getByRole("button", { name: "Adicionar KR" }).click();
    await expect(krDialog.getByText(krTitle)).toBeVisible();
    await krDialog.getByRole("button", { name: "Fechar" }).click();

    const publishObjectiveResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/publish_okr_objective_v2"),
    );
    await objectiveCard.getByRole("button", { name: "Publicar" }).click();
    await assertRpcResponse(
      "publish_okr_objective_v2",
      await publishObjectiveResponse,
    );
    await expect(
      objectiveCard.getByRole("button", { name: "Publicar" }),
    ).toBeHidden();
    await objectiveCard.getByRole("button", { name: "Iniciativas" }).click();
    const initiativeDialog = page.getByRole("dialog").filter({
      hasText: objectiveTitle,
    });
    await initiativeDialog.getByRole("textbox").first().fill(initiativeTitle);
    await initiativeDialog.getByRole("button", { name: /adicionar|criar/i }).click();
    await expect(initiativeDialog.getByText(initiativeTitle)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(initiativeDialog).toBeHidden();

    await objectiveCard.getByRole("button", { name: "Review" }).click();
    const reviewDialog = page.getByRole("dialog").filter({
      hasText: objectiveTitle,
    });
    const reviewTextareas = reviewDialog.locator("textarea");
    await reviewTextareas.nth(0).fill("Resultado validado pelo E2E.");
    await reviewTextareas.nth(3).fill("Manter cadência e evidências.");
    const submitReviewResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/submit_okr_objective_review_v1"),
    );
    await reviewDialog.getByRole("button", { name: "Enviar review" }).click();
    await assertRpcResponse(
      "submit_okr_objective_review_v1",
      await submitReviewResponse,
    );
    const approveReviewResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/approve_okr_objective_review_v1"),
    );
    await reviewDialog.getByRole("button", { name: "Aprovar", exact: true }).click();
    await assertRpcResponse(
      "approve_okr_objective_review_v1",
      await approveReviewResponse,
    );
    await expect(reviewDialog.getByText("Aprovada", { exact: true })).toBeVisible();

    await chooseRadixOption(
      reviewDialog.getByText("Selecione", { exact: true }),
      targetCode,
    );
    await reviewDialog.getByPlaceholder("Motivo do carry-forward").fill(
      "Continuidade aprovada no encerramento E2E.",
    );
    const carryForwardResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/carry_forward_okr_objective_v1"),
    );
    await reviewDialog.getByRole("button", { name: "Transferir objective" }).click();
    await assertRpcResponse(
      "carry_forward_okr_objective_v1",
      await carryForwardResponse,
    );
    await expect(page.getByText(/objective transferido/i)).toBeVisible();
    await reviewDialog.getByRole("button", { name: "Fechar" }).click();

    await page.goto("/okr/ciclos");
    const refreshedSourceCard = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: sourceCode, exact: true }),
    });
    const startClosingResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/start_okr_cycle_closing_v1"),
    );
    await refreshedSourceCard.getByRole("button", { name: /iniciar fechamento/i }).click();
    await assertRpcResponse(
      "start_okr_cycle_closing_v1",
      await startClosingResponse,
    );

    await page.goto("/okr/objectives");
    await chooseRadixOption(page.getByRole("combobox").first(), sourceCode);
    const cycleReview = page.getByText("Review do ciclo").locator("..").locator("..");
    const cycleReviewTextareas = cycleReview.locator("textarea");
    await cycleReviewTextareas.nth(0).fill("Ciclo E2E concluído.");
    await cycleReviewTextareas.nth(3).fill("Fluxo integral validado.");
    const consolidateCycleReviewResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/upsert_okr_cycle_review_v1"),
    );
    await cycleReview.getByRole("button", { name: "Consolidar review" }).click();
    await assertRpcResponse(
      "upsert_okr_cycle_review_v1",
      await consolidateCycleReviewResponse,
    );
    const approveCycleResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/approve_okr_cycle_review_v1"),
    );
    await cycleReview.getByRole("button", { name: "Aprovar e encerrar ciclo" }).click();
    await assertRpcResponse(
      "approve_okr_cycle_review_v1",
      await approveCycleResponse,
    );
    await expect(page.getByText(/ciclo aprovado e encerrado/i)).toBeVisible();

    await page.goto("/okr/ciclos");
    await archiveCycle(page, sourceCode);
    await cancelAndArchiveCycle(page, targetCode);
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
  await expect(
    page.getByRole("cell", { name: input.code, exact: true }),
  ).toBeVisible();
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

async function assertRpcResponse(
  rpcName: string,
  response: import("@playwright/test").Response,
) {
  if (response.ok()) return;
  const responseBody = (await response.text()).slice(0, 600);
  throw new Error(
    `${rpcName} failed with HTTP ${response.status()}: ${responseBody}`,
  );
}

async function archiveCycle(
  page: import("@playwright/test").Page,
  cycleCode: string,
) {
  const row = cycleRow(page, cycleCode);
  const archiveResponse = page.waitForResponse((response) =>
    response.url().includes("/rpc/archive_okr_cycle_v1"),
  );
  await row.getByRole("button", { name: "Arquivar" }).click();
  await assertRpcResponse("archive_okr_cycle_v1", await archiveResponse);
  await expect(row.getByText("Arquivado", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Arquivar" })).toBeHidden();
}

async function cancelAndArchiveCycle(
  page: import("@playwright/test").Page,
  cycleCode: string,
) {
  const row = cycleRow(page, cycleCode);
  const cancelResponse = page.waitForResponse((response) =>
    response.url().includes("/rpc/cancel_okr_cycle_v1"),
  );
  page.once("dialog", (dialog) =>
    dialog.accept("Limpeza automática do cenário canário E2E."),
  );
  await row.getByRole("button", { name: "Cancelar" }).click();
  await assertRpcResponse("cancel_okr_cycle_v1", await cancelResponse);
  await expect(row.getByRole("button", { name: "Arquivar" })).toBeVisible();
  await archiveCycle(page, cycleCode);
}

function cycleRow(page: import("@playwright/test").Page, cycleCode: string) {
  return page.getByRole("row").filter({
    has: page.getByRole("cell", { name: cycleCode, exact: true }),
  });
}

async function dismissOnboarding(page: import("@playwright/test").Page) {
  const skipTutorial = page.getByText(/pular tutorial/i);
  const appeared = await skipTutorial
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) return;
  await skipTutorial.click();
  await expect(skipTutorial).toBeHidden();
}
