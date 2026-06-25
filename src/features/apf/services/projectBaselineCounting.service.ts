import type {
  ProjectBaselineProcessCandidate,
  ProjectBaselineProcessItem,
} from "../types/apfRuntime.types";
import { normalizeElementaryProcessKey } from "../utils/elementaryProcess";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferImpactFactor(
  storyText: string,
  availableFactors: string[],
): string {
  const text = normalize(storyText);
  const has = (sigla: string) => availableFactors.includes(sigla);

  if (/\b(excluir|exclusao|remover|retirar|desativar)\b/.test(text) && has("E")) {
    return "E";
  }
  if (/\b(migrar|migracao|carga de dados)\b/.test(text) && has("PMD")) {
    return "PMD";
  }
  if (/\b(corrigir|correcao|erro|bug|defeito)\b/.test(text)) {
    if (has("COR50")) return "COR50";
    if (has("COR")) return "COR";
  }

  // Quando a função já existe na baseline do projeto, a manutenção padrão é
  // alteração. Inclusão é reservada a uma nova função que não exista nela.
  if (has("A")) return "A";
  if (has("I")) return "I";
  return availableFactors[0] ?? "N/A";
}

export function hasDeterministicProcessMatch(
  candidates: ProjectBaselineProcessCandidate[],
): boolean {
  const first = candidates[0];
  const second = candidates[1];
  if (!first) return false;
  return Number(first.match_score) >= 0.72
    && (!second || Number(first.match_score) - Number(second.match_score) >= 0.1);
}

export function parseProcessSelection(raw: string): {
  processRefs: string[];
  factorSigla: string | null;
  confidence: number;
  reasoning: string;
} {
  const clean = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: any;

  try {
    parsed = JSON.parse(clean);
  } catch {
    const candidate = clean.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) throw new Error("A IA não retornou uma seleção de processo válida.");
    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }

  const refs = parsed.process_refs
    ?? parsed.processRefs
    ?? parsed.processes
    ?? (parsed.process_ref ? [parsed.process_ref] : []);

  if (!Array.isArray(refs) || refs.length === 0) {
    throw new Error("A IA não selecionou nenhum processo da baseline.");
  }

  return {
    processRefs: refs.map((ref: unknown) => String(ref).toUpperCase()),
    factorSigla: parsed.factor_sigla
      ? String(parsed.factor_sigla).toUpperCase()
      : parsed.factorSigla
        ? String(parsed.factorSigla).toUpperCase()
        : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6))),
    reasoning: String(parsed.reasoning ?? parsed.justification ?? ""),
  };
}

export function buildProjectBaselineItems(args: {
  candidates: ProjectBaselineProcessCandidate[];
  selectedProcessRefs: string[];
  factorSigla: string;
  huRef: string;
  evidence: string;
  confidence: number;
  reasoning: string;
  matchType: "baseline_process_exact" | "baseline_process_ai";
}) {
  const selected = new Set(args.selectedProcessRefs.map((ref) => ref.toUpperCase()));
  const items = new Map<string, {
    candidate: ProjectBaselineProcessCandidate;
    item: ProjectBaselineProcessItem;
  }>();

  for (const candidate of args.candidates) {
    if (!selected.has(candidate.process_ref.toUpperCase())) continue;
    for (const item of candidate.items) {
      items.set(item.id, { candidate, item });
    }
  }

  if (items.size === 0) {
    throw new Error("Os processos selecionados não possuem itens na baseline ativa.");
  }

  return [...items.values()].map(({ candidate, item }) => ({
    baseline_item_id: item.id,
    hu_ref: args.huRef,
    ef_description: item.description,
    function_sigla: item.is_measurable ? item.function_sigla : "N/A",
    factor_sigla: item.is_measurable ? args.factorSigla : "N/A",
    match_type: args.matchType,
    confidence: args.confidence,
    justification: args.reasoning
      || `Processo ${candidate.process_ref} identificado na baseline do projeto.`,
    evidence_literal: args.evidence,
    category_sigla: item.category_sigla,
    complexity: item.complexity,
    elementary_process_key: normalizeElementaryProcessKey(
      `${item.item_ref} ${item.description}`,
    ),
    elementary_process_name: item.description,
    process_objective: candidate.process_name,
    process_role: item.is_measurable ? "independent" : "auxiliary",
    process_is_complete: item.is_measurable,
    process_is_independent: item.is_measurable,
    process_reasoning:
      "A função está registrada como item separado na baseline oficial do projeto.",
    separation_precedent_ref: candidate.process_ref,
  }));
}
