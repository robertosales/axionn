import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("operational console routing contract", () => {
  const app = source("src/App.tsx");

  it.each([
    "/organization/admin",
    "/organization/companies",
    "/organization/contracts",
    "/organization/projects",
    "/organization/teams",
    "/organization/members",
    "/organization/usage",
    "/organization/settings",
    "/platform/plans",
    "/platform/subscriptions",
    "/platform/ai-providers",
  ])("keeps the protected route %s registered", (route) => {
    expect(app).toContain(`path=\"${route}\"`);
  });

  it("keeps organization and platform guards separated", () => {
    expect(app).toContain("function OrganizationAdminGuard");
    expect(app).toContain("function PlatformAdminGuard");
    expect(app).toContain("isOrganizationAdmin");
    expect(app).toContain("isPlatformAdmin");
    expect(app).toContain(
      "const { loading: organizationLoading, isPlatformAdmin } = useOrganization();",
    );
  });

  it("keeps the legacy fallback under runtime flags", () => {
    expect(app).toContain("is_organization_operational_console_enabled");
    expect(app).toContain("is_legacy_operational_admin_fallback_enabled");
  });
});

describe("backoffice routing contract", () => {
  const app = source("src/App.tsx");
  const organizationShell = source(
    "src/features/organization/components/OrganizationAdminShell.tsx",
  );
  const migration = source(
    "supabase/migrations/20260708143000_backoffice_foundation.sql",
  );
  const guard = source("src/backoffice/guards/BackofficeGuard.tsx");

  it.each([
    "/backoffice",
    "/backoffice/clientes",
    "/backoffice/financeiro",
    "/backoffice/equipe",
    "/backoffice/suporte",
    "/backoffice/analitico",
    "/backoffice/configuracoes",
  ])("keeps the backoffice route %s registered", (route) => {
    expect(app).toContain(`path=\"${route}\"`);
  });

  it("keeps backoffice outside the organization operational guard", () => {
    expect(app).toContain("function AuthenticatedRoute");
    expect(app).toContain("function BackofficeRoute");
    expect(app).toContain("<BackofficeGuard requiredRoles={requiredRoles}>");
  });

  it("opens the backoffice from the platform administration menu", () => {
    expect(organizationShell).toContain('<Link to="/backoffice">');
  });

  it("uses owner staff membership as the backoffice authority", () => {
    expect(migration).toContain("create table if not exists public.owner_staff_members");
    expect(migration).toContain("get_my_backoffice_staff_profile");
    expect(migration).toContain("assert_backoffice_staff");
    expect(guard).toContain("useBackofficeAuth");
    expect(guard).toContain("requiredRoles");
  });
});

describe("platform plan management contract", () => {
  const app = source("src/App.tsx");
  const migration = source(
    "supabase/migrations/20260708133000_platform_plan_management.sql",
  );
  const planService = source("src/features/platform/services/plans.service.ts");

  it("routes the platform home to plan management", () => {
    expect(app).toContain('Navigate to="/platform/plans"');
  });

  it("exposes only platform-admin RPCs for plan and subscription mutations", () => {
    expect(migration).toContain("perform public.assert_platform_admin_v2()");
    expect(migration).toContain("create_platform_saas_plan_v1");
    expect(migration).toContain("update_platform_saas_plan_v1");
    expect(migration).toContain("set_platform_organization_subscription_v1");
    expect(migration).toContain(
      "upsert_platform_organization_entitlement_override_v1",
    );
    expect(migration).toContain("resource_type");
    expect(migration).not.toContain("entity_type");
  });

  it("keeps the frontend on RPC access instead of direct table writes", () => {
    expect(planService).toContain("list_platform_saas_plans_v1");
    expect(planService).toContain("set_platform_organization_subscription_v1");
    expect(planService).not.toContain('.from("saas_plans")');
    expect(planService).not.toContain('.from("organization_subscriptions")');
  });
});

describe("platform AI security contract", () => {
  const platformConsole = source(
    "src/features/platform/components/PlatformAIProvidersConsole.tsx",
  );
  const compatibilityExport = source(
    "src/features/admin/pages/AdminIAsPage.ts",
  );
  const edgeWrapper = source(
    "supabase/functions/apf-generate/index.ts",
  );
  const edgeTest = source(
    "supabase/functions/platform-ai-provider-test/index.ts",
  );
  const config = source("supabase/config.toml");

  it("routes the legacy admin import to the hardened console", () => {
    expect(compatibilityExport).toContain("PlatformAIProvidersConsole");
  });

  it("tests providers only through the sanitized platform endpoint", () => {
    expect(platformConsole).toContain('"platform-ai-provider-test"');
    expect(platformConsole).not.toContain("rawError");
    expect(platformConsole).not.toContain('invoke("apf-generate"');
  });

  it("requires platform_user_roles in both provider test paths", () => {
    expect(edgeWrapper).toContain('from("platform_user_roles")');
    expect(edgeTest).toContain('from("platform_user_roles")');
    expect(edgeWrapper).toContain("sanitizeTestResponse");
    expect(edgeWrapper).toContain('await import("./legacy.ts")');
    expect(edgeTest).not.toContain("rawError");
  });

  it("keeps JWT verification enabled for all AI functions", () => {
    expect(config).toContain("[functions.apf-generate]");
    expect(config).toContain("[functions.platform-ai-provider-test]");
    expect(config).toContain("[functions.process-ai-briefing]");
    expect(config.match(/verify_jwt = true/g)).toHaveLength(3);
  });
});
