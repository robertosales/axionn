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
});
