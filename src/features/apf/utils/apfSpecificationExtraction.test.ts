import { describe, expect, it } from "vitest";
import { extractApfCriteriaFromText, extractApfSpecificationFromText } from "./apfSpecificationExtraction";
describe("APF specification extraction", () => {
  it("extracts bullets below acceptance heading", () => {
    expect(
      extractApfCriteriaFromText(
        "## Critérios de Aceite\n- Deve salvar o cadastro\n- Deve exibir confirmação",
      ).map((x) => x.originalText),
    ).toEqual(["Deve salvar o cadastro", "Deve exibir confirmação"]);
  });
  it("extracts explicit CA identifiers outside a section", () => {
    expect(
      extractApfCriteriaFromText("CA-7: Validar acesso do usuário")[0]
        ?.originalText,
    ).toBe("Validar acesso do usuário");
  });
  it("deduplicates and assigns stable ids", () => {
    const result = extractApfCriteriaFromText(
      "Critérios de aceite:\n1. Gerar relatório\n2. Gerar relatório",
    );
    expect(result).toHaveLength(1);
    expect(result[0].stableId).toBe("CA-01");
  });
});

it("extracts the complete functional structure", () => {
  const result = extractApfSpecificationFromText("# Objetivo\nPermitir pagamento\n## Atores\n- Cliente\n## Regras de negócio\n- Exigir saldo\n## Objetos funcionais\n- Pagamento\n## Operações\n- Confirmar\n## Fronteira\n- API financeira\n## Requisitos não funcionais\n- Responder em 2s\n## Critérios de aceite\n- Deve confirmar");
  expect(result).toMatchObject({ objective: "Permitir pagamento", actors: ["Cliente"], businessRules: ["Exigir saldo"], functionalObjects: ["Pagamento"], operations: ["Confirmar"], boundaries: ["API financeira"], nonFunctionalRequirements: ["Responder em 2s"] });
  expect(result.criteria).toHaveLength(1);
});
