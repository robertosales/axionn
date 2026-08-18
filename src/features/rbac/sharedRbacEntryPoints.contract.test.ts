import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("entradas compartilhadas de configurações e RBAC", () => {
  it("usa o workspace RBAC canônico em Sala Ágil, Sustentação e RDM", () => {
    const salaAgil = read("src/pages/Index.tsx");
    const sustentacao = read("src/features/sustentacao/SustentacaoPage.tsx");
    const rdm = read("src/features/rdm/RdmPage.tsx");

    expect(salaAgil).toContain("<RbacWorkspace />");
    expect(sustentacao).toContain("<RbacWorkspace />");
    expect(rdm).toContain("<RbacWorkspace />");
    expect(sustentacao).not.toContain("<UserRolesManager />");
    expect(rdm).not.toContain("<UserRolesManager />");
  });

  it("mantém times separados por módulo e membros no componente compartilhado", () => {
    const salaAgil = read("src/pages/Index.tsx");
    const sustentacao = read("src/features/sustentacao/SustentacaoPage.tsx");
    const rdm = read("src/features/rdm/RdmPage.tsx");

    expect(salaAgil).toContain('useModuleTeam("sala_agil")');
    expect(sustentacao).toContain('useModuleTeam("sustentacao")');
    expect(rdm).toContain('useModuleTeam("rdm")');
    expect(salaAgil).toContain("<TeamMembersManager />");
    expect(sustentacao).toContain("<TeamMembersManager />");
    expect(rdm).toContain("<TeamMembersManager />");
    expect(rdm).toContain('<TeamManager moduleFilter="rdm" />');
  });

  it("exibe a função operacional de cada participação sem confundi-la com o perfil RBAC", () => {
    const manager = read("src/components/UserRolesManager.tsx");
    const profileSheet = read("src/components/UserProfileSheet.tsx");

    expect(manager).toContain('select("user_id, role, teams(id, name, module)")');
    expect(manager).toContain('role: String(membership.role || "Membro")');
    expect(manager).toContain('role: String(m.role || "Membro")');
    expect(manager).toContain("} · {t.role}");
    expect(profileSheet).toContain("module: ModuleKey | string; role: string");
    expect(profileSheet).toContain("} · {t.role}");
  });
});
