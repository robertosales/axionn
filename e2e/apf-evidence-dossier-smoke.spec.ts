import { expect, test } from "../playwright-fixture";
import {
  creator,
  fingerprintDownload,
  hasCrossTenantSet,
  hasFullIdentitySet,
  homologator,
  maskIdentity,
  missingIdentitiesMessage,
  openApfDossierWorkspace,
  openDossierByCode,
  organizationId,
  otherOrganizationId,
  otherTenantUser,
  readAuthenticatedUserId,
  restQueryAsUser,
  seedOrganization,
  signIn,
  signInForLocalE2e,
  supabasePublishableKey,
  supabaseUrl,
  validator,
  writeHomologationReport,
} from "./support/apfHomologation";

const legacyEmail = process.env.E2E_USER_EMAIL,
  legacyPassword = process.env.E2E_USER_PASSWORD;

test.describe("Dossiê APF por Impacto", () => {
  test.skip(
    !(legacyEmail && legacyPassword && organizationId),
    "Defina as credenciais e a organização E2E.",
  );
  test("carrega o workspace operacional e consulta somente a organização selecionada", async ({
    page,
  }) => {
    const failures: string[] = [];
    const creationOptionResponses: Array<{
      resource: string;
      status: number;
      rows: number | null;
    }> = [];
    page.on("response", async (response) => {
      if (
        (response.url().includes("/rest/v1/apf_") ||
          response.url().includes("/rest/v1/rpc/get_apf")) &&
        !response.ok()
      )
        failures.push(`${response.status()} ${response.url()}`);
      const match = response
        .url()
        .match(/\/rest\/v1\/(projects|teams|project_teams|user_stories)(?:\?|$)/);
      if (!match) return;
      let rows: number | null = null;
      try {
        const body = (await response.json()) as unknown;
        rows = Array.isArray(body) ? body.length : null;
      } catch {
        // O status ainda é útil quando a resposta não contém JSON.
      }
      creationOptionResponses.push({
        resource: match[1],
        status: response.status(),
        rows,
      });
    });
    await seedOrganization(page, organizationId!);
    await signInForLocalE2e(page, {
      role: "homologator",
      email: legacyEmail!,
      password: legacyPassword!,
    });
    await page.goto("/sala-agil/medicao-evidencias", {
      waitUntil: "domcontentloaded",
    });
    const skipTutorial = page.getByRole("button", { name: /pular tutorial/i });
    if (
      await skipTutorial
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await skipTutorial.click();
    }
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
      await expect(
        page.getByText(new RegExp(`^\\d+\\.\\s*${step}$`, "i")),
      ).toBeVisible();

    await page.getByRole("button", { name: /novo dossiê/i }).click();
    const dialog = page.getByRole("dialog", { name: /novo dossiê apf/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Projeto").click();
    const projectOptions = page.getByRole("option");
    await expect.poll(() => projectOptions.count()).toBeGreaterThan(0);
    await projectOptions.first().click();

    await dialog.getByLabel("História de usuário").click();
    const storyOptions = page.getByRole("option");
    await expect
      .poll(
        async () => {
          const count = await storyOptions.count();
          if (count === 0) {
            return JSON.stringify(creationOptionResponses);
          }
          return "stories-loaded";
        },
        { message: "Respostas das opções de criação" },
      )
      .toBe("stories-loaded");
    await storyOptions.first().click();

    await dialog.getByLabel("Sessão de contagem").click();
    const sessionOptions = page.getByRole("option");
    await expect.poll(() => sessionOptions.count()).toBeGreaterThan(0);
    const sessionLabels = await sessionOptions.allTextContents();
    expect(sessionLabels.join("\n")).not.toMatch(/\bin_progress\b/i);
    expect(sessionLabels.join("\n")).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-/i);

    expect(failures).toEqual([]);
  });
});

/**
 * Homologação ponta a ponta com três identidades distintas.
 * Cada etapa roda em um contexto de navegador novo, o que encerra a sessão
 * anterior. Nenhuma senha é escrita em log, relatório ou screenshot e
 * nenhuma chave service_role é utilizada.
 */
test.describe("Homologação APF — criador, validador e homologador", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasFullIdentitySet, missingIdentitiesMessage());
  test.setTimeout(180_000);

  const runId = Date.now().toString(36).toUpperCase();
  const dossierCode = `E2E-APF-${runId}`;
  const dossierTitle = `Fixture E2E de homologação ${runId}`;
  const batchCode = `E2E-MED-${runId}`;
  const artifacts: Array<Record<string, unknown>> = [];
  const identities: Record<string, string> = {};
  let creatorUserId: string | null = null;
  let validatorUserId: string | null = null;
  let homologatorUserId: string | null = null;
  let frozenHash: string | null = null;
  let frozenVersion: string | null = null;
  let dossierId: string | null = null;

  test("1 · criador autentica, cria o dossiê piloto e coleta evidência", async ({
    browser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await seedOrganization(page, organizationId!);
    await signIn(page, creator!);
    creatorUserId = await readAuthenticatedUserId(page);
    identities.creator = maskIdentity(creator!.email);

    await openApfDossierWorkspace(page);
    await page.getByRole("button", { name: /novo dossiê/i }).click();
    const dialog = page.getByRole("dialog", { name: /novo dossiê apf/i });

    await dialog.getByLabel("Projeto").click();
    const projectOptions = page.getByRole("option");
    if ((await projectOptions.count()) === 0) {
      throw new Error(
        "pré-condição de domínio ausente: nenhum projeto APF disponível na organização de homologação.",
      );
    }
    await projectOptions.first().click();

    await dialog.getByLabel("História de usuário").click();
    const storyOptions = page.getByRole("option");
    if ((await storyOptions.count()) === 0) {
      throw new Error(
        "pré-condição de domínio ausente: nenhuma HU disponível no projeto selecionado.",
      );
    }
    await storyOptions.first().click();

    await dialog.getByLabel("Sessão de contagem").click();
    const sessionOptions = page.getByRole("option").filter({
      hasNotText: /vincular posteriormente/i,
    });
    if ((await sessionOptions.count()) === 0) {
      throw new Error(
        "pré-condição de domínio ausente: nenhuma sessão de contagem vinculável ao dossiê piloto.",
      );
    }
    await sessionOptions.first().click();

    await dialog.getByLabel("Código do dossiê").fill(dossierCode);
    await dialog.getByLabel("Título").fill(dossierTitle);
    await dialog.getByRole("button", { name: /criar dossiê/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(dossierCode).first()).toBeVisible();

    await openDossierByCode(page, dossierCode);

    // Critério de aceite rastreável.
    await page.getByRole("tab", { name: /^especificação$/i }).click();
    await page.getByRole("button", { name: /adicionar critério/i }).click();
    await page
      .getByLabel("Texto original")
      .first()
      .fill(`Critério piloto ${runId}: comportamento verificável documentado.`);
    await page
      .getByLabel("Comportamento esperado")
      .first()
      .fill("O sistema registra a evidência associada ao critério.");
    await page.getByLabel("Decisão funcional").first().click();
    await page.getByRole("option", { name: "Atende", exact: true }).click();
    await page.getByRole("button", { name: /^salvar$/i }).first().click();
    await expect(page.getByText(/critério adicionado/i)).toBeVisible();

    // Coleta de evidência manual verificada.
    await page.getByRole("tab", { name: /evidências/i }).click();
    await page.getByRole("button", { name: /adicionar evidência/i }).click();
    const evidenceDialog = page.getByRole("dialog", {
      name: /adicionar evidência manual/i,
    });
    await evidenceDialog
      .getByLabel("Resumo verificável")
      .fill(`Evidência automatizada da execução ${runId}.`);
    await evidenceDialog
      .getByLabel("URL permanente")
      .fill(`https://axionn.app/e2e/${runId}`);
    await evidenceDialog
      .getByLabel("Justificativa da evidência manual")
      .fill("Fixture criada pela suíte de homologação ponta a ponta.");
    await evidenceDialog
      .getByLabel("Hash ou commit de origem")
      .fill(runId.toLowerCase().padEnd(12, "0"));
    await evidenceDialog.getByLabel("Verificação").click();
    await page.getByRole("option", { name: "verified", exact: true }).click();
    await evidenceDialog.getByRole("button", { name: /salvar evidência/i }).click();
    await expect(evidenceDialog).toBeHidden();

    // Vínculo evidência ↔ critério.
    await page.getByRole("button", { name: /vincular ca/i }).first().click();
    const linkDialog = page.getByRole("dialog", {
      name: /vincular critério de aceite/i,
    });
    await linkDialog.getByLabel("Critério").click();
    await page.getByRole("option").first().click();
    await linkDialog.getByRole("button", { name: /^vincular$/i }).click();
    await expect(linkDialog).toBeHidden();

    dossierId = await resolveDossierId(page, dossierCode);
    artifacts.push({ step: "create", dossierCode, dossierId, actor: identities.creator });
    await context.close();
  });

  test("2 · validador autentica em nova sessão e congela a versão", async ({
    browser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await seedOrganization(page, organizationId!);
    await signIn(page, validator!);
    validatorUserId = await readAuthenticatedUserId(page);
    identities.validator = maskIdentity(validator!.email);

    await openApfDossierWorkspace(page);
    await openDossierByCode(page, dossierCode);
    await page.getByRole("tab", { name: /documento/i }).click();

    const validateButton = page.getByRole("button", {
      name: /validar e congelar/i,
    });
    await expect(validateButton).toBeVisible();
    if (await validateButton.isDisabled()) {
      const blocked = await page
        .getByLabel("Bloqueado")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.parentElement?.textContent?.trim() ?? ""),
        );
      throw new Error(
        `pré-condição de domínio ausente: checklist de prontidão bloqueado (${blocked.join(" | ")}).`,
      );
    }
    await validateButton.click();

    const hashLine = page.getByText(/^v\d+ · SHA-256 [0-9a-f]{16,}/);
    await expect(hashLine).toBeVisible({ timeout: 60_000 });
    const rawHash = (await hashLine.textContent()) ?? "";
    frozenVersion = rawHash.match(/^v(\d+)/)?.[1] ?? null;
    frozenHash = rawHash.match(/SHA-256\s+([0-9a-f]+)/)?.[1] ?? null;
    expect(frozenHash, "hash da versão imutável não capturado").toBeTruthy();

    artifacts.push({
      step: "validate",
      dossierCode,
      version: frozenVersion,
      contentSha256: frozenHash,
      actor: identities.validator,
    });
    await context.close();
  });

  test("3 · homologador homologa, exporta JSON/ZIP/PDF e confere auditoria", async ({
    browser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await seedOrganization(page, organizationId!);
    await signIn(page, homologator!);
    homologatorUserId = await readAuthenticatedUserId(page);
    identities.homologator = maskIdentity(homologator!.email);

    expect(
      homologatorUserId,
      "homologador não pode ser a mesma identidade do criador",
    ).not.toBe(creatorUserId);
    expect(
      homologatorUserId,
      "homologador não pode ser a mesma identidade do validador",
    ).not.toBe(validatorUserId);

    await openApfDossierWorkspace(page);
    await openDossierByCode(page, dossierCode);
    await page.getByRole("tab", { name: /documento/i }).click();

    await page.getByRole("button", { name: /^homologar$/i }).click();
    await page.getByRole("button", { name: /confirmar homologação/i }).click();
    await expect(page.getByText(/homologada/i).first()).toBeVisible({
      timeout: 60_000,
    });

    // Exportação JSON da versão imutável.
    const jsonDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^json$/i }).first().click();
    artifacts.push(await fingerprintDownload(await jsonDownload, "dossie-json"));

    // Consolidação em lote para exportar ZIP e PDF do pacote de auditoria.
    await page.getByRole("button", { name: /voltar para dossiês/i }).click();
    await page.getByRole("button", { name: /novo lote/i }).click();
    const batchDialog = page.getByRole("dialog", {
      name: /novo lote de medição/i,
    });
    await batchDialog.getByLabel("Código").fill(batchCode);
    await batchDialog
      .getByRole("checkbox")
      .filter({ has: page.locator("xpath=..") })
      .first()
      .waitFor();
    await batchDialog
      .locator("label", { hasText: dossierCode })
      .getByRole("checkbox")
      .click();
    await batchDialog.getByRole("button", { name: /criar lote/i }).click();
    await expect(batchDialog).toBeHidden();

    const batchCard = page.locator("div").filter({ hasText: batchCode }).last();
    const zipDownload = page.waitForEvent("download");
    await batchCard.getByRole("button", { name: "Exportar ZIP" }).click();
    artifacts.push(await fingerprintDownload(await zipDownload, "auditoria-zip"));

    const pdfDownload = page.waitForEvent("download");
    await batchCard.getByRole("button", { name: "Exportar PDF" }).click();
    artifacts.push(await fingerprintDownload(await pdfDownload, "auditoria-pdf"));

    // Eventos de auditoria lidos com a sessão do próprio homologador (RLS ativo).
    if (supabaseUrl && supabasePublishableKey && dossierId) {
      const events = await restQueryAsUser<
        Array<{ event_type: string; created_at: string }>
      >(
        page,
        `apf_dossier_events?dossier_id=eq.${dossierId}&select=event_type,created_at&order=created_at.asc`,
      );
      expect(events.status, "leitura dos eventos de auditoria falhou").toBe(200);
      const eventTypes = (events.body ?? []).map((event) => event.event_type);
      expect(
        eventTypes.some((type) => /valid/i.test(type)),
        `evento de validação ausente: ${eventTypes.join(", ")}`,
      ).toBe(true);
      expect(
        eventTypes.some((type) => /homolog/i.test(type)),
        `evento de homologação ausente: ${eventTypes.join(", ")}`,
      ).toBe(true);
      artifacts.push({ step: "audit", dossierId, eventTypes });
    } else {
      test.info().annotations.push({
        type: "pendente",
        description:
          "Eventos de auditoria não conferidos via API: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
      });
    }

    // O domínio mantém dossiês homologados imutáveis: a fixture permanece
    // identificável pelo código E2E-APF-* e não pode ser removida.
    test.info().annotations.push({
      type: "fixture",
      description: `Dossiê ${dossierCode} homologado e imutável por regra de domínio; remoção não permitida.`,
    });

    const reportPath = writeHomologationReport({
      runId,
      organizationId,
      dossierCode,
      dossierId,
      batchCode,
      version: frozenVersion,
      contentSha256: frozenHash,
      identities,
      distinctActors:
        creatorUserId !== homologatorUserId &&
        validatorUserId !== homologatorUserId,
      artifacts,
    });
    test.info().annotations.push({
      type: "relatório",
      description: reportPath,
    });
    await context.close();
  });
});

test.describe("Isolamento cross-tenant do dossiê APF", () => {
  test.skip(
    !hasCrossTenantSet,
    "pendente: defina E2E_APF_OTHER_ORGANIZATION_ID, E2E_APF_OTHER_USER_EMAIL e E2E_APF_OTHER_USER_PASSWORD.",
  );

  test("usuário de outra organização não enxerga dossiês da organização principal", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await seedOrganization(page, otherOrganizationId!);
    await signIn(page, otherTenantUser!);
    await openApfDossierWorkspace(page);

    await expect(page.getByText(/^E2E-APF-/)).toHaveCount(0);

    if (supabaseUrl && supabasePublishableKey && organizationId) {
      const leaked = await restQueryAsUser<Array<unknown>>(
        page,
        `apf_evidence_dossiers?organization_id=eq.${organizationId}&select=id`,
      );
      expect([200, 401, 403]).toContain(leaked.status);
      if (leaked.status === 200) expect(leaked.body ?? []).toHaveLength(0);
    }
    await context.close();
  });
});

async function resolveDossierId(
  page: import("@playwright/test").Page,
  dossierCode: string,
) {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  const response = await restQueryAsUser<Array<{ id: string }>>(
    page,
    `apf_evidence_dossiers?dossier_code=eq.${encodeURIComponent(dossierCode)}&select=id`,
  );
  return response.body?.[0]?.id ?? null;
}
