import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("nomes acessíveis de controles contextuais", () => {
  it("nomeia ações de RDM pelo registro afetado", () => {
    const rdm = source("src/features/rdm/components/RdmList.tsx");
    expect(rdm).toContain('aria-label="Atualizar lista de RDMs"');
    expect(rdm).toContain("Abrir detalhes da RDM");
    expect(rdm).toContain("Excluir RDM ${rdm.codigo");
  });

  it("nomeia o menu de ações de cada projeto", () => {
    expect(source("src/features/admin/components/ProjetosAdminPanel.tsx"))
      .toContain("Abrir ações do projeto ${p.name}");
  });

  it("nomeia a remoção de filtros do dashboard", () => {
    expect(source("src/components/dashboard/DashboardFilters.tsx"))
      .toContain("Remover filtro de ${FILTER_LABELS");
  });

  it("nomeia remoção, cancelamento e aplicação de filtros do Kanban", () => {
    const kanban = source("src/components/KanbanFilterBar.tsx");
    expect(kanban).toContain('aria-label="Limpar busca do Kanban"');
    expect(kanban).toContain('aria-label="Cancelar criação da visualização"');
    expect(kanban).toContain("Remover filtro de ${CHIP_LABELS");
    expect(kanban).toContain("Aplicar visualização ${view.label}");
    expect(kanban).toContain("Excluir visualização ${view.label}");
  });
});
