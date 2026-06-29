import { describe, expect, it } from "vitest";
import {
  humanizeWorkflowStatus,
  isTerminalWorkflowStatus,
  resolveWorkflowStatus,
} from "./useMemberCapacityDetail";

describe("workflow status presentation", () => {
  it("traduz status padrão do Kanban", () => {
    expect(resolveWorkflowStatus("em_teste", [])).toMatchObject({
      label: "Em Teste",
      hex: "#fbbf24",
    });
  });

  it("usa o rótulo configurado para etapa personalizada", () => {
    expect(resolveWorkflowStatus("etapa_1779795590841", [{
      key: "etapa_1779795590841",
      label: "Análise de Processo",
      hex: "#22d3ee",
      dot_color: "bg-cyan-400",
    }])).toMatchObject({
      label: "Análise de Processo",
      hex: "#22d3ee",
    });
  });

  it("não expõe identificador técnico de etapa órfã", () => {
    expect(humanizeWorkflowStatus("etapa_1779795590841"))
      .toBe("Etapa não configurada");
  });

  it("identifica status terminais com normalização", () => {
    expect(isTerminalWorkflowStatus("Concluída")).toBe(true);
    expect(isTerminalWorkflowStatus("em_teste")).toBe(false);
  });
});
