import type {
  ApfAcceptanceCriterion,
  ApfAuditScenario,
  ApfDossierCountingMemory,
  ApfEvidenceDossierSummary,
  ApfEvidenceSource,
} from "../types/apfEvidenceDossier.types";
type Logical = {
  counting_item_id: string;
  recognizable: boolean;
  maintained_by_application: boolean;
  independent_lifecycle: boolean;
  inside_boundary: boolean;
  used_by_transaction: boolean;
  decision: string;
  justification: string;
};
type Exception = {
  counting_item_id: string;
  disposition: string;
  absorbed_by_item_id: string | null;
  justification: string;
};
type Finding = {
  finding_type: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
  resolution_note: string | null;
};
type Event = {
  event_type: string;
  actor_id: string | null;
  event_data: Record<string, unknown>;
  created_at: string;
};
type Trace = {
  acceptance_criterion_id: string;
  evidence_source_id: string;
  counting_item_id: string | null;
  functional_result: string;
  apf_treatment: string | null;
  justification: string | null;
  suggested_by_ai: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
};
export interface ApfDossierDocumentContext {
  contractSnapshot: Record<string, unknown>;
  baselineSnapshot: Record<string, unknown>;
  rulesetSnapshot: Record<string, unknown>;
  sprintId: string | null;
  previous: { dossierCode: string; pf: number } | null;
  createdBy: string;
  validatedBy: string | null;
  validatedAt: string | null;
  homologatedBy: string | null;
  homologatedAt: string | null;
  totalHomologatedPf: number | null;
  logicalFiles: Logical[];
  exceptions: Exception[];
  findings: Finding[];
  events: Event[];
  traceability: Trace[];
}
export interface ApfDossierDocumentData {
  dossier: ApfEvidenceDossierSummary;
  criteria: ApfAcceptanceCriterion[];
  evidence: ApfEvidenceSource[];
  counting: ApfDossierCountingMemory;
  scenarios: ApfAuditScenario[];
  context?: ApfDossierDocumentContext;
}
const cell = (value: unknown) =>
  String(value ?? "—")
    .split("|").join("\\|")
    .split("\n").join(" ");
const pf = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(2).replace(".", ",");
const bool = (value: boolean) => (value ? "Sim" : "Não");
const json = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
const empty = (rows: string[], columns: number) =>
  rows.length ? rows : [`| ${Array(columns).fill("—").join(" | ")} |`];
export function renderApfDossierMarkdown(data: ApfDossierDocumentData): string {
  const { dossier, criteria, evidence, counting, scenarios } = data;
  const c = data.context;
  const itemName = new Map(counting.items.map((i) => [i.id, i.description]));
  const evName = new Map(evidence.map((e) => [e.id, e.stableId]));
  const criterionName = new Map(criteria.map((x) => [x.id, x.stableId]));
  const git = evidence.filter(
    (e) => e.sourceType === "merge_request" || e.sourceType === "commit",
  );
  const logical = c?.logicalFiles ?? [];
  const exceptions = c?.exceptions ?? [];
  const findings = c?.findings ?? [];
  const persistedTrace = c?.traceability ?? [];
  const trace = persistedTrace.length
    ? persistedTrace
    : criteria.flatMap((criterion) =>
        evidence
          .filter((source) => source.criterionIds.includes(criterion.id))
          .map((source) => ({
            acceptance_criterion_id: criterion.id,
            evidence_source_id: source.id,
            counting_item_id: null,
            functional_result: criterion.decision,
            apf_treatment: null,
            justification: null,
            suggested_by_ai: false,
            confirmed_by: null,
            confirmed_at: null,
          })),
      );
  const complementary = evidence.filter((e) => e.criterionIds.length === 0);
  const specification = evidence.find((item) => item.metadata?.structured_extraction)?.metadata?.structured_extraction as Record<string, unknown> | undefined;
  const total =
    c?.totalHomologatedPf ??
    dossier.totalHomologatedPf ??
    counting.calculatedTotalPf;
  const lines = [
    `# Dossiê APF por Impacto — ${dossier.dossierCode}`,
    "",
    `## 1. Identificação da HU e da medição`,
    "",
    `- **HU:** ${dossier.userStory ? `${dossier.userStory.code} — ${dossier.userStory.title}` : "Não vinculada"}`,
    `- **Organização:** ${dossier.organizationId}`,
    `- **Contrato:** ${dossier.contractId}`,
    `- **Projeto:** ${dossier.projectId}`,
    `- **Sprint/medição:** ${c?.sprintId ?? "—"}`,
    `- **Tipo:** ${dossier.countingType}`,
    `- **Sessão:** ${counting.sessionId}`,
    `- **Status:** ${dossier.status}`,
    `- **Objetivo funcional:** ${cell(specification?.objective)}`,
    `- **Atores:** ${cell(Array.isArray(specification?.actors) ? specification.actors.join(", ") : null)}`,
    `- **Fronteiras:** ${cell(Array.isArray(specification?.boundaries) ? specification.boundaries.join(", ") : null)}`,
    `- **Requisitos não funcionais:** ${cell(Array.isArray(specification?.nonFunctionalRequirements) ? specification.nonFunctionalRequirements.join(", ") : null)}`,
    "",
    `## 2. Resumo executivo`,
    "",
    `O dossiê consolida ${criteria.length} critério(s), ${evidence.length} evidência(s) e ${counting.items.length} item(ns) APF. A memória ${counting.closes ? "fecha" : "não fecha"} com a sessão e totaliza **${pf(counting.calculatedTotalPf)} PF impactados**.`,
    "",
    `## 3. Regras de medição aplicadas`,
    "",
    "### Contrato congelado",
    "```json",
    json(c?.contractSnapshot),
    "```",
    "### Baseline congelada",
    "```json",
    json(c?.baselineSnapshot),
    "```",
    "### Ruleset congelado",
    "```json",
    json(c?.rulesetSnapshot),
    "```",
    "",
    `## 4. Merge requests, commits e mudanças`,
    "",
    "| Evidência | Tipo | Repositório | MR/commit | Arquivo | URL | Hash |",
    "|---|---|---|---|---|---|---|",
    ...empty(
      git.map(
        (e) =>
          `| ${cell(e.stableId)} | ${cell(e.sourceType)} | ${cell(e.repository)} | ${cell(e.mergeRequestRef ?? e.commitSha)} | ${cell(e.filePath)} | ${cell(e.permanentUrl)} | ${cell(e.contentHash)} |`,
      ),
      7,
    ),
    "",
    `## 5. Matriz de rastreabilidade CA × evidências`,
    "",
    "| CA | Esperado | Evidência | Resultado | Tratamento APF | Justificativa | Confirmação |",
    "|---|---|---|---|---|---|---|",
    ...empty(
      trace.map((t) => {
        const cr = criteria.find((x) => x.id === t.acceptance_criterion_id);
        return `| ${cell(criterionName.get(t.acceptance_criterion_id))} | ${cell(cr?.expectedBehavior ?? cr?.originalText)} | ${cell(evName.get(t.evidence_source_id))} | ${cell(t.functional_result)} | ${cell(t.apf_treatment)} | ${cell(t.justification)} | ${cell(t.confirmed_by)} |`;
      }),
      7,
    ),
    "",
    `## 6. Catálogo de evidências`,
    "",
    "| ID | Categoria | Fonte | Verificação | Resumo | Autor/data | Justificativa | URL |",
    "|---|---|---|---|---|---|---|---|",
    ...empty(
      evidence.map(
        (e) =>
          `| ${cell(e.stableId)} | ${cell(e.category)} | ${cell(e.sourceType)} | ${cell(e.verificationStatus)} | ${cell(e.summary)} | ${cell(`${e.collectedBy ?? "—"} / ${e.collectedAt}`)} | ${cell(e.metadata?.justification)} | ${cell(e.permanentUrl)} |`,
      ),
      8,
    ),
    "",
    `## 7. Contagem transacional`,
    "",
    "| Processo | Tipo | Impacto | Complexidade | PF base | Fator | PF impactado | Decisão |",
    "|---|---|---|---|---:|---:|---:|---|",
    ...empty(
      counting.items
        .filter((i) => !i.ret)
        .map(
          (i) =>
            `| ${cell(i.description)} | ${cell(i.functionType)} | ${cell(i.impactFactor)} | ${cell(i.complexity)} | ${pf(i.basePf)} | ${pf(i.contributionPercent)}% | ${pf(i.impactedPf)} | ${cell(i.decision)} |`,
        ),
      8,
    ),
    "",
    `## 8. Detalhamento DET/FTR`,
    "",
    "| Processo | DET | FTR | Revisão métrica | Justificativa |",
    "|---|---:|---:|---|---|",
    ...empty(
      counting.items
        .filter((i) => i.det != null || i.ftr != null)
        .map(
          (i) =>
            `| ${cell(i.description)} | ${cell(i.det)} | ${cell(i.ftr)} | ${i.hasMetricReview ? "Revisado" : "Original"} | ${cell(i.metricReviewJustification)} |`,
        ),
      5,
    ),
    "",
    `## 9. Contagem de arquivos lógicos`,
    "",
    "| Arquivo | Tipo | DET | RET | Complexidade | PF impactado |",
    "|---|---|---:|---:|---|---:|",
    ...empty(
      counting.items
        .filter(
          (i) =>
            i.ret != null || logical.some((l) => l.counting_item_id === i.id),
        )
        .map(
          (i) =>
            `| ${cell(i.description)} | ${cell(i.functionType)} | ${cell(i.det)} | ${cell(i.ret)} | ${cell(i.complexity)} | ${pf(i.impactedPf)} |`,
        ),
      6,
    ),
    "",
    `## 10. Detalhamento DET/RET`,
    "",
    "| Arquivo | DET | RET | Revisão métrica | Justificativa |",
    "|---|---:|---:|---|---|",
    ...empty(
      counting.items
        .filter((i) => i.ret != null)
        .map(
          (i) =>
            `| ${cell(i.description)} | ${cell(i.det)} | ${cell(i.ret)} | ${i.hasMetricReview ? "Revisado" : "Original"} | ${cell(i.metricReviewJustification)} |`,
        ),
      5,
    ),
    "",
    `## 11. Matriz de decisão ALI/AIE ou ILF/EIF`,
    "",
    "| Arquivo | Reconhecível | Mantido | Ciclo independente | Dentro da fronteira | Usado por transação | Decisão | Justificativa |",
    "|---|---|---|---|---|---|---|---|",
    ...empty(
      logical.map(
        (l) =>
          `| ${cell(itemName.get(l.counting_item_id) ?? l.counting_item_id)} | ${bool(l.recognizable)} | ${bool(l.maintained_by_application)} | ${bool(l.independent_lifecycle)} | ${bool(l.inside_boundary)} | ${bool(l.used_by_transaction)} | ${cell(l.decision)} | ${cell(l.justification)} |`,
      ),
      8,
    ),
    "",
    `## 12. Quadro executivo da contagem`,
    "",
    `- **PF da sessão:** ${pf(counting.sessionTotalPf)}`,
    `- **PF calculado:** ${pf(counting.calculatedTotalPf)}`,
    `- **PF homologado:** ${pf(total)}`,
    `- **PF com override:** ${pf(counting.items.filter((i) => i.hasHumanOverride).reduce((s, i) => s + i.impactedPf, 0))}`,
    `- **Itens de exceção:** ${exceptions.length}`,
    "",
    `## 13. Memória de cálculo`,
    "",
    "| Item | PF base | Contribuição | PF impactado | Validado |",
    "|---|---:|---:|---:|---|",
    ...counting.items.map(
      (i) =>
        `| ${cell(i.description)} | ${pf(i.basePf)} | ${pf(i.contributionPercent)}% | ${pf(i.impactedPf)} | ${bool(i.isValidated)} |`,
    ),
    `| **Total** | | | **${pf(counting.calculatedTotalPf)} PF** | ${counting.closes ? "Fechado" : "Divergente"} |`,
    "",
    `## 14. Comparação com precontagem ou contagem anterior`,
    "",
    c?.previous
      ? `Dossiê anterior **${c.previous.dossierCode}**: ${pf(c.previous.pf)} PF. Variação: **${pf(counting.calculatedTotalPf - c.previous.pf)} PF**.`
      : "Não há contagem anterior vinculada.",
    "",
    `## 15. Arquivos e links de evidência`,
    "",
    "| Evidência | Arquivo/símbolo | Link | Hash |",
    "|---|---|---|---|",
    ...empty(
      evidence.map(
        (e) =>
          `| ${cell(e.stableId)} | ${cell(e.filePath ?? e.symbolRef)} | ${cell(e.permanentUrl)} | ${cell(e.contentHash)} |`,
      ),
      4,
    ),
    "",
    `## 16. Evidências técnicas complementares sem PF`,
    "",
    "| Evidência | Categoria | Resumo | Verificação |",
    "|---|---|---|---|",
    ...empty(
      complementary.map(
        (e) =>
          `| ${cell(e.stableId)} | ${cell(e.category)} | ${cell(e.summary)} | ${cell(e.verificationStatus)} |`,
      ),
      4,
    ),
    "",
    `## 17. Riscos e cenários alternativos de auditoria`,
    "",
    "| Origem | Severidade/classificação | Descrição | Δ PF | Efeito financeiro | Status |",
    "|---|---|---|---:|---:|---|",
    ...empty(
      [
        ...scenarios.map(
          (s) =>
            `| Cenário | ${cell(s.alternativeClassification)} | ${cell(s.title)} — ${cell(s.rationale)} | ${pf(s.pfDelta)} | ${s.financialEffect === null ? "—" : s.financialEffect.toFixed(2)} | ${cell(s.status)} |`,
        ),
        ...findings.map(
          (f) =>
            `| Achado | ${cell(f.severity)} | ${cell(f.title)} — ${cell(f.detail)} | — | — | ${cell(f.status)} |`,
        ),
      ],
      6,
    ),
    "",
    `## 18. Valor consolidado e status de homologação`,
    "",
    `- **PF consolidado:** ${pf(total)}`,
    `- **Status:** ${dossier.status}`,
    `- **Criado por:** ${c?.createdBy ?? "—"}`,
    `- **Validado por/em:** ${c?.validatedBy ?? "—"} / ${c?.validatedAt ?? "—"}`,
    `- **Homologado por/em:** ${c?.homologatedBy ?? "—"} / ${c?.homologatedAt ?? "—"}`,
    "",
    "### Trilha de decisões",
    "| Evento | Responsável | Data | Dados |",
    "|---|---|---|---|",
    ...empty(
      (c?.events ?? []).map(
        (e) =>
          `| ${cell(e.event_type)} | ${cell(e.actor_id)} | ${cell(e.created_at)} | ${cell(JSON.stringify(e.event_data))} |`,
      ),
      4,
    ),
    "",
    "---",
    "Documento reproduzido deterministicamente a partir do snapshot persistido. Não houve recálculo ou chamada de IA na renderização.",
    "",
  ];
  return lines.join("\n");
}
export async function sha256Hex(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
