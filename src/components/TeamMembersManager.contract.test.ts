import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("src/components/TeamMembersManager.tsx"), "utf8");

describe("gestão segura de participações em times", () => {
  it("identifica o time e o módulo administrados", () => {
    expect(source).toContain("activeTeam.name");
    expect(source).toContain("activeModuleLabel");
    expect(source).toContain("A identidade e os outros vínculos da pessoa são preservados");
  });

  it("remove somente o vínculo após confirmação acessível", () => {
    expect(source).toContain("<ConfirmDialog");
    expect(source).toContain('title="Remover participação do time?"');
    expect(source).toContain('confirmLabel="Remover deste time"');
    expect(source).toContain("os perfis RBAC e as participações em outros times serão preservados");
    expect(source).not.toContain('confirm("Remover este membro do time?")');
  });

  it("altera somente a função operacional da participação existente", () => {
    expect(source).toContain('"update_organization_team_member_role_v2"');
    expect(source).toContain('.update({ role: nextRole })');
    expect(source).toContain("Editar função no time");
    expect(source).toContain("A identidade, os perfis RBAC e os outros vínculos não serão modificados");
    expect(source).toContain("Função no time atualizada");
  });
});
