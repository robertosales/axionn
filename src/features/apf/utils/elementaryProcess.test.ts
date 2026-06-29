import { describe, expect, it } from "vitest";
import {
  deriveElementaryProcessSemantics,
  isAuxiliaryAction,
  normalizeElementaryProcessKey,
} from "./elementaryProcess";

describe("elementary process rules", () => {
  it("normaliza uma chave estável de processo", () => {
    expect(normalizeElementaryProcessKey("Distribuir Processos Bancários"))
      .toBe("distribuir-processos-bancarios");
  });

  it("identifica preview, histórico e validação como ações auxiliares", () => {
    expect(isAuxiliaryAction("Visualizar preview da distribuição")).toBe(true);
    expect(isAuxiliaryAction("Consultar histórico do processo")).toBe(true);
    expect(isAuxiliaryAction("Validar distribuição bancária")).toBe(true);
    expect(isAuxiliaryAction("Distribuir processo bancário")).toBe(false);
  });

  it("absorve ação auxiliar sem precedente oficial", () => {
    const result = deriveElementaryProcessSemantics(
      {
        elementary_process_name: "Visualizar preview da distribuição",
      },
      "Visualizar preview da distribuição",
    );

    expect(result).toMatchObject({
      process_role: "auxiliary",
      process_is_complete: false,
      process_is_independent: false,
      separation_precedent_ref: null,
    });
  });

  it("permite processo independente quando existe precedente da baseline", () => {
    const result = deriveElementaryProcessSemantics(
      {
        elementary_process_name: "Consultar histórico do processo",
        process_role: "independent",
        process_is_complete: true,
        process_is_independent: true,
      },
      "Consultar histórico do processo",
      "HU-HIST-001",
    );

    expect(result).toMatchObject({
      process_role: "independent",
      process_is_complete: true,
      process_is_independent: true,
      separation_precedent_ref: "HU-HIST-001",
    });
  });

  it("mantém processo central como unidade contável", () => {
    const result = deriveElementaryProcessSemantics(
      {
        central_process: "Distribuir processo bancário",
        process_objective: "Encaminhar o processo ao destino selecionado",
      },
      "Distribuir processo bancário",
      "HU200",
    );

    expect(result).toMatchObject({
      elementary_process_key: "distribuir-processo-bancario",
      process_role: "central",
      process_is_complete: true,
      process_is_independent: true,
      separation_precedent_ref: "HU200",
    });
  });
});
