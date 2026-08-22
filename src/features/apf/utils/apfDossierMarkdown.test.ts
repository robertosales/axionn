import { describe, expect, it } from "vitest";
import { renderApfDossierMarkdown, type ApfDossierDocumentData } from "./apfDossierMarkdown";

const fixture = {
  dossier: { id: "d1", organizationId: "o1", contractId: null, projectId: null, userStoryId: "u1", dossierCode: "APF-01", title: "Cadastro", countingType: "impact", status: "draft", totalImpactedPf: 0, totalHomologatedPf: null, countingSessionId: "s1", updatedAt: "2026-08-17", userStory: { code: "HU-1", title: "Cadastrar" } },
  criteria: [{ id: "c1", dossierId: "d1", stableId: "CA-01", sortOrder: 0, originalText: "Salvar cadastro", expectedBehavior: "Registro salvo", decision: "meets", sourceType: "manual", reviewedAt: "2026-08-17" }],
  evidence: [{ id: "e1", dossierId: "d1", stableId: "EV-API-01", sourceType: "endpoint", category: "api", summary: "POST /items", permanentUrl: null, contentHash: "abc", verificationStatus: "verified", collectedAt: "2026-08-17", criterionIds: ["c1"] }],
  counting: { sessionId: "s1", sessionStatus: "validated", sessionTotalPf: 4, calculatedTotalPf: 4, closes: true, items: [{ id: "i1", description: "Cadastrar item", huRef: "HU-1", functionType: "EE", impactFactor: "I", complexity: "Baixa", decision: "counted", det: 5, ftr: 1, ret: null, basePf: 4, contributionPercent: 100, impactedPf: 4, isValidated: true, hasHumanOverride: false, hasMetricReview: false, metricReviewJustification: null }] },
  scenarios: [],
} satisfies ApfDossierDocumentData;

describe("renderApfDossierMarkdown", () => {
  it("is deterministic and includes traceability and calculation memory", () => {
    const first = renderApfDossierMarkdown(fixture);
    expect(renderApfDossierMarkdown(fixture)).toBe(first);
    expect(first).toContain("CA-01");
    expect(first).toContain("EV-API-01");
    expect(first).toContain("**4,00 PF**");
    for (let section = 1; section <= 18; section += 1) expect(first).toContain(`## ${section}.`);
    expect(first).toContain("Matriz de decisão ALI/AIE");
    expect(first).toContain("Documento reproduzido deterministicamente");
    expect(first).not.toContain(new Date().toISOString());
  });
});
