import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Download, Page } from "@playwright/test";

/**
 * Utilitários da homologação ponta a ponta do Dossiê APF por Impacto.
 *
 * Regra de segurança: senhas vêm exclusivamente de variáveis de ambiente e
 * nunca são registradas em log, relatório, screenshot ou código. O relatório
 * gerado contém apenas identificadores, hashes e carimbos de tempo.
 */

export type ApfIdentityRole = "creator" | "validator" | "homologator" | "other";

export type ApfIdentity = {
  role: ApfIdentityRole;
  email: string;
  password: string;
};

const REPORT_PATH = path.join(
  process.cwd(),
  "test-results",
  "apf-homologation-report.json",
);

function readIdentity(role: ApfIdentityRole, prefix: string): ApfIdentity | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { role, email, password };
}

export const organizationId = process.env.E2E_ORGANIZATION_ID ?? null;
export const otherOrganizationId =
  process.env.E2E_APF_OTHER_ORGANIZATION_ID ?? null;

export const creator = readIdentity("creator", "E2E_APF_CREATOR");
export const validator = readIdentity("validator", "E2E_APF_VALIDATOR");
export const homologator = readIdentity("homologator", "E2E_APF_HOMOLOGATOR");
export const otherTenantUser = readIdentity("other", "E2E_APF_OTHER_USER");

export const hasFullIdentitySet = Boolean(
  creator && validator && homologator && organizationId,
);
export const hasCrossTenantSet = Boolean(otherTenantUser && otherOrganizationId);

/** Descreve credenciais ausentes sem revelar valores. */
export function missingIdentitiesMessage(): string {
  const missing: string[] = [];
  if (!creator) missing.push("E2E_APF_CREATOR_EMAIL/PASSWORD");
  if (!validator) missing.push("E2E_APF_VALIDATOR_EMAIL/PASSWORD");
  if (!homologator) missing.push("E2E_APF_HOMOLOGATOR_EMAIL/PASSWORD");
  if (!organizationId) missing.push("E2E_ORGANIZATION_ID");
  return `credencial/sessão indisponível: defina ${missing.join(", ")}.`;
}

/** Máscara determinística para e-mails em relatórios (sem expor o endereço). */
export function maskIdentity(email: string): string {
  return `sha256:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
}

export async function seedOrganization(page: Page, orgId: string) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("selectedOrganizationId", value);
  }, orgId);
}

export async function signIn(page: Page, identity: ApfIdentity) {
  await page.goto("/auth", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel(/e-mail/i).fill(identity.email);
  await page.getByRole("textbox", { name: /^senha/i }).fill(identity.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 })
    .catch(() => {
      throw new Error(
        `credencial/sessão indisponível para o papel "${identity.role}" (${maskIdentity(identity.email)}).`,
      );
    });
  await markOnboardingCompleteLocally(page);
}

export async function markOnboardingCompleteLocally(page: Page) {
  const userId = await readAuthenticatedUserId(page);
  if (!userId) {
    throw new Error("credencial/sessão indisponível: sessão não encontrada no armazenamento local.");
  }
  await page.evaluate((id) => {
    window.localStorage.setItem("axion_onboarding_done", id);
  }, userId);
  return userId;
}

export async function readAuthenticatedUserId(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw) as {
          user?: { id?: string };
          currentSession?: { user?: { id?: string } };
        };
        const id = value.user?.id ?? value.currentSession?.user?.id;
        if (id) return id;
      } catch {
        // procura a próxima chave
      }
    }
    return null;
  });
}

/** Token de acesso da própria sessão do usuário (nunca service_role). */
export async function readAccessToken(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
        };
        const token = value.access_token ?? value.currentSession?.access_token;
        if (token) return token;
      } catch {
        // procura a próxima chave
      }
    }
    return null;
  });
}

export const supabaseUrl = process.env.VITE_SUPABASE_URL ?? null;
export const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? null;

/**
 * Consulta o PostgREST usando a sessão do próprio usuário autenticado.
 * Nunca utiliza service_role: o objetivo é comprovar o comportamento do RLS.
 */
export async function restQueryAsUser<T = unknown>(
  page: Page,
  resourcePath: string,
): Promise<{ status: number; body: T | null }> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são necessários para conferir eventos de auditoria.",
    );
  }
  const token = await readAccessToken(page);
  if (!token) throw new Error("credencial/sessão indisponível: token ausente.");
  return page.evaluate(
    async ([url, apikey, accessToken, resource]) => {
      const response = await fetch(`${url}/rest/v1/${resource}`, {
        headers: {
          apikey: apikey as string,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      return { status: response.status, body: body as never };
    },
    [supabaseUrl, supabasePublishableKey, token, resourcePath] as const,
  );
}

export async function openApfDossierWorkspace(page: Page) {
  await page.goto("/sala-agil/medicao-evidencias", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByRole("tab", { name: /dossiês apf/i }).click();
}

export async function openDossierByCode(page: Page, dossierCode: string) {
  await page
    .getByRole("button", { name: `Abrir dossiê ${dossierCode}` })
    .click();
  await page.getByRole("tab", { name: /^especificação$/i }).waitFor();
}

/** Salva o download em disco e devolve nome + hash, sem conteúdo sensível. */
export async function fingerprintDownload(download: Download, label: string) {
  const directory = path.join(process.cwd(), "test-results", "apf-exports");
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${label}-${download.suggestedFilename()}`);
  await download.saveAs(target);
  const bytes = readFileSync(target);
  return {
    label,
    fileName: download.suggestedFilename(),
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export type HomologationReport = Record<string, unknown>;

export function writeHomologationReport(report: HomologationReport) {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`,
    "utf8",
  );
  return REPORT_PATH;
}

/**
 * Autentica o navegador de teste sem passar pela tela de login.
 *
 * Útil para executar o app local contra o Supabase remoto, pois o rate limiter
 * de produção pode rejeitar origens localhost. A proteção do produto não é
 * alterada e a senha nunca é escrita em logs, screenshots ou storage state.
 */
export async function signInForLocalE2e(page: Page, identity: ApfIdentity) {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("configuração do Supabase indisponível para o E2E local.");
  }

  const response = await page.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      data: { email: identity.email, password: identity.password },
      headers: {
        apikey: supabasePublishableKey,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `credencial/sessão indisponível para o papel "${identity.role}" (${maskIdentity(identity.email)}; HTTP ${response.status()}).`,
    );
  }

  const session = (await response.json()) as Record<string, unknown>;
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: `sb-${projectRef}-auth-token`, value: session },
  );
}
