import { describe, expect, it } from "vitest";
import { qualityTestCaseSchema } from "./testCase.schema";

describe("qualityTestCaseSchema", () => {
  const valid = {
    organizationId: "11111111-1111-4111-8111-111111111111",
    title: "Login válido",
    testType: "functional",
    priority: "medium",
    severity: "medium",
    status: "draft",
    executionMode: "manual",
    tags: [],
    steps: [{ action: "Efetuar login", expectedResult: "A sessão é iniciada" }],
  };

  it("aceita um caso manual válido", () => {
    expect(qualityTestCaseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita caso sem etapas", () => {
    expect(qualityTestCaseSchema.safeParse({ ...valid, steps: [] }).success).toBe(false);
  });

  it("rejeita etapa sem resultado esperado", () => {
    expect(qualityTestCaseSchema.safeParse({ ...valid, steps: [{ action: "Entrar" }] }).success).toBe(false);
  });
});
