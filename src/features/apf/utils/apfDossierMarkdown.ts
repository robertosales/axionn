import type { ApfAcceptanceCriterion, ApfAuditScenario, ApfDossierCountingMemory, ApfEvidenceDossierSummary, ApfEvidenceSource } from "../types/apfEvidenceDossier.types";

export interface ApfDossierDocumentData {
  dossier: ApfEvidenceDossierSummary;
  criteria: ApfAcceptanceCriterion[];
  evidence: ApfEvidenceSource[];
  counting: ApfDossierCountingMemory;
  scenarios: ApfAuditScenario[];
}

const cell = (value: unknown) => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const pf = (value: number) => value.toFixed(2).replace(".", ",");

export function renderApfDossierMarkdown(data: ApfDossierDocumentData): string {
  const { dossier, criteria, evidence, counting, scenarios } = data;
  const lines = [
    `# Dossiê APF por Impacto — ${dossier.dossierCode}`,
    "",
    `## ${dossier.title}`,
    "",
    `- **HU:** ${dossier.userStory ? `${dossier.userStory.code} — ${dossier.userStory.title}` : "Não vinculada"}`,
    `- **Tipo de contagem:** ${dossier.countingType}`,
    `- **Status:** ${dossier.status}`,
    `- **Sessão de contagem:** ${counting.sessionId}`,
    `- **PF impactado:** ${pf(counting.calculatedTotalPf)}`,
    "",
    "## Rastreabilidade CA × evidências",
    "",
    "| CA | Critério | Decisão | Evidências |",
    "|---|---|---|---|",
    ...criteria.map((criterion) => `| ${cell(criterion.stableId)} | ${cell(criterion.originalText)} | ${cell(criterion.decision)} | ${cell(evidence.filter((item) => item.criterionIds.includes(criterion.id)).map((item) => item.stableId).join(", "))} |`),
    "",
    "## Catálogo de evidências",
    "",
    "| ID | Categoria | Fonte | Verificação | Resumo |",
    "|---|---|---|---|---|",
    ...evidence.map((item) => `| ${cell(item.stableId)} | ${cell(item.category)} | ${cell(item.sourceType)} | ${cell(item.verificationStatus)} | ${cell(item.summary)} |`),
    "",
    "## Contagem e memória de cálculo",
    "",
    "| Processo/arquivo | Tipo | Impacto | DET | FTR | RET | Complexidade | PF base | Fator | PF impactado | Decisão |",
    "|---|---|---|---:|---:|---:|---|---:|---:|---:|---|",
    ...counting.items.map((item) => `| ${cell(item.description)} | ${cell(item.functionType)} | ${cell(item.impactFactor)} | ${cell(item.det)} | ${cell(item.ftr)} | ${cell(item.ret)} | ${cell(item.complexity)} | ${pf(item.basePf)} | ${pf(item.contributionPercent)}% | ${pf(item.impactedPf)} | ${cell(item.decision)} |`),
    `| **Total** | | | | | | | | | **${pf(counting.calculatedTotalPf)} PF** | ${counting.closes ? "Fechado" : "Divergente"} |`,
    "",
    "## Riscos e cenários alternativos",
    "",
    "| Cenário | Classificação alternativa | Δ PF | Efeito financeiro | Status | Justificativa |",
    "|---|---|---:|---:|---|---|",
    ...scenarios.map((scenario) => `| ${cell(scenario.title)} | ${cell(scenario.alternativeClassification)} | ${pf(scenario.pfDelta)} | ${scenario.financialEffect === null ? "—" : scenario.financialEffect.toFixed(2)} | ${cell(scenario.status)} | ${cell(scenario.rationale)} |`),
    "",
    "---",
    "Documento produzido deterministicamente a partir dos dados persistidos no dossiê.",
    "",
  ];
  return lines.join("\n");
}

export async function sha256Hex(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
