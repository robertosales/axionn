import { expect, test } from "../playwright-fixture";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const organizationId = process.env.E2E_ORGANIZATION_ID;
const hasCredentials = Boolean(email && password && organizationId);

test.describe("RBAC — governança e acesso temporário", () => {
  test.skip(
    !hasCredentials,
    "Defina E2E_USER_EMAIL, E2E_USER_PASSWORD e E2E_ORGANIZATION_ID.",
  );

  test("carrega o workspace e a central de governança sem mutações", async ({
    page,
  }) => {
    page.setDefaultTimeout(20_000);
    const failedRpcs: string[] = [];

    page.on("response", (response) => {
      if (response.url().includes("/rest/v1/rpc/") && !response.ok()) {
        failedRpcs.push(`${new URL(response.url()).pathname}:${response.status()}`);
      }
    });

    await page.addInitScript((orgId) => {
      window.localStorage.setItem("selectedOrganizationId", orgId);
    }, organizationId!);

    await login(page);
    await markOnboardingCompleteLocally(page);
    await page.goto("/sala-agil/perfis", { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(
      page.getByRole("heading", { name: /perfis e permissões/i }),
    ).toBeVisible();

    for (const tabName of [
      /perfis de acesso/i,
      /atribuições/i,
      /simulador/i,
      /histórico/i,
      /governança/i,
    ]) {
      await expect(page.getByRole("tab", { name: tabName })).toBeVisible();
    }

    const auditResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/list_rbac_audit_events_v1"),
    );
    await page.getByRole("tab", { name: /histórico/i }).click();
    await assertRpcResponse("list_rbac_audit_events_v1", await auditResponse);
    await expect(page.getByText(/histórico de acesso|nenhuma alteração encontrada/i).first()).toBeVisible();

    const membersResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/get_organization_members_v2"),
    );
    await page.getByRole("tab", { name: /simulador/i }).click();
    await assertRpcResponse("get_organization_members_v2", await membersResponse);
    await page.getByRole("combobox", { name: /usuário para simulação/i }).click();
    await page.getByRole("option").first().click();
    const simulationResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/simulate_rbac_user_access_v1"),
    );
    await page.getByRole("button", { name: /simular acesso/i }).click();
    await assertRpcResponse("simulate_rbac_user_access_v1", await simulationResponse);
    await expect(page.getByRole("region", { name: /resumo do acesso simulado/i })).toBeVisible();

    const governanceResponse = page.waitForResponse((response) =>
      response.url().includes("/rpc/list_rbac_governance_v1"),
    );
    await page.getByRole("tab", { name: /governança/i }).click();
    const response = await governanceResponse;
    await assertRpcResponse("list_rbac_governance_v1", response);

    await expect(page.getByText("Aguardando revisão", { exact: true })).toBeVisible();
    await expect(page.getByText("Acessos temporários", { exact: true })).toBeVisible();
    await expect(page.getByText("Sinais para revisar", { exact: true })).toBeVisible();
    await expect(page.getByText(/governança baseada em evidências/i)).toBeVisible();

    await page.getByRole("tab", { name: /temporários/i }).click();
    await expect(
      page.getByText(/nenhum acesso temporário|prazo:/i).first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: /menor privilégio/i }).click();
    await expect(
      page.getByText(/nenhum sinal crítico|eventos em 90 dias/i).first(),
    ).toBeVisible();

    expect(failedRpcs, `RPCs com falha: ${failedRpcs.join(", ")}`).toEqual([]);
  });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const emailField = page.getByLabel(/e-mail/i);
  const passwordField = page.getByRole("textbox", { name: /^senha/i });
  await emailField.fill(email!);
  await passwordField.fill(password!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 20_000,
  });
}

async function markOnboardingCompleteLocally(page: import("@playwright/test").Page) {
  const userId = await page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.includes("auth-token")) continue;
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) continue;
      try {
        const value = JSON.parse(rawValue) as {
          user?: { id?: string };
          currentSession?: { user?: { id?: string } };
        };
        const id = value.user?.id ?? value.currentSession?.user?.id;
        if (id) return id;
      } catch {
        // Continua procurando outra chave de sessão.
      }
    }
    return null;
  });

  if (!userId) throw new Error("Não foi possível identificar o usuário autenticado no armazenamento local.");
  await page.evaluate((id) => {
    window.localStorage.setItem("axion_onboarding_done", id);
  }, userId);
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
