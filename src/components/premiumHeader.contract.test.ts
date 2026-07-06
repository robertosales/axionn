import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("premium header layout contract", () => {
  const accountControls = source("src/components/GlobalLogoutButton.tsx");
  const organizationSwitcher = source("src/components/OrganizationSwitcherImpl.tsx");
  const organizationWrapper = source("src/components/OrganizationSwitcher.tsx");

  it("keeps organization context inside the module header flow", () => {
    expect(accountControls).toContain("PremiumShellHeaderControls");
    expect(accountControls).toContain('variant="context"');
    expect(accountControls).toContain("pageContext.appendChild(companyMount)");
    expect(accountControls).toContain("premiumCompanyContext");
  });

  it("keeps the company label visible and distinct from account controls", () => {
    expect(organizationSwitcher).toContain("Empresa");
    expect(organizationSwitcher).toContain(
      'variant?: "floating" | "inline" | "compact" | "context"',
    );
    expect(accountControls).toContain("premiumCompanyContext");
    expect(accountControls).toContain("premiumAccountControls");
  });

  it("suppresses floating organization controls on owned shells", () => {
    expect(organizationWrapper).toContain("hasManagedApplicationChrome");
    expect(organizationWrapper).toContain('variant === "floating"');
  });

  it("keeps logout inside the user account menu", () => {
    expect(accountControls).toContain("Abrir menu da conta");
    expect(accountControls).toContain("Sair");
    expect(accountControls).toContain("DropdownMenuItem");
  });
});
