import type {
  ProjectBaselineProcessCandidate,
  ProjectBaselineProcessItem,
} from "../types/apfRuntime.types";
import { normalizeElementaryProcessKey } from "../utils/elementaryProcess";

const STOP_WORDS = new Set([
  "para", "com", "dos", "das", "uma", "por", "que", "sistema",
  "funcionalidade", "processo", "gesp", "gesp3", "usuario",
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .map(stem)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function lexicalScore(storyText: string, item: ProjectBaselineProcessItem) {
  const storyTokens = tokens(storyText);
  if (!storyTokens.size) return 0;

  // process_name é comum a todas as linhas do grupo e não participa da
  // distinção entre EE/CE/SE. A seleção usa a descrição específica da linha.
  const itemTokens = tokens([
    item.process_ref,
    item.description,
    item.product_reference,
    item.project_reference,
    item.measurement_reference,
  ].filter(Boolean).join(" "));
  const overlap = [...storyTokens].filter((token) => itemTokens.has(token)).length;
  return overlap / storyTokens.size;
}

export function selectDeterministicBaselineItems(
  storyText: string,
  candidate: ProjectBaselineProcessCandidate,
) {
  const scored = candidate.items
    .filter((item) => item.is_measurable)
    .map((item) => ({ item, score: lexicalScore(storyText, item) }))
    .sort((a, b) => b.score - a.score);
  const first = scored[0];
  const second = scored[1];

  if (!first || first.score < 0.4) return null;
  if (second && first.score - second.score < 0.08) return null;

  const selected = scored.filter(({ score }) =>
    score >= 0.4 && score >= first.score - 0.08
  );

  return {
    itemIds: selected.map(({ item }) => item.id),
    confidence: Math.min(1, first.score),
    reasoning: `${selected.length} item(ns) do processo ${candidate.process_ref} apresentaram evidência lexical dominante na HU.`,
  };
}

export function parseBaselineItemSelection(raw: string) {
  const clean = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: any;

  try {
    parsed = JSON.parse(clean);
  } catch {
    const candidate = clean.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) throw new Error("A IA não retornou uma seleção válida.");
    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }

  const itemIds = parsed.baseline_item_ids
    ?? parsed.item_ids
    ?? parsed.itemIds
    ?? [];
  if (!Array.isArray(itemIds) || !itemIds.length) {
    throw new Error("A IA não selecionou itens funcionais da baseline.");
  }

  return {
    itemIds: itemIds.map((id: unknown) => String(id)),
    factorSigla: parsed.factor_sigla
      ? String(parsed.factor_sigla).toUpperCase()
      : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6))),
    reasoning: String(parsed.reasoning ?? parsed.justification ?? ""),
  };
}

export function buildSelectedBaselineItems(args: {
  candidates: ProjectBaselineProcessCandidate[];
  selectedItemIds: string[];
  factorSigla: string;
  huRef: string;
  evidence: string;
  confidence: number;
  reasoning: string;
  matchType: "baseline_process_exact" | "baseline_process_ai";
}) {
  const selectedIds = new Set(args.selectedItemIds);
  const selected: Array<{
    candidate: ProjectBaselineProcessCandidate;
    item: ProjectBaselineProcessItem;
  }> = [];

  for (const candidate of args.candidates) {
    for (const item of candidate.items) {
      if (selectedIds.has(item.id)) selected.push({ candidate, item });
    }
  }

  if (!selected.length) {
    throw new Error("Os itens selecionados não pertencem à baseline ativa.");
  }

  return selected.map(({ candidate, item }) => ({
    baseline_item_id: item.id,
    hu_ref: args.huRef,
    ef_description: item.description,
    function_sigla: item.is_measurable ? item.function_sigla : "N/A",
    factor_sigla: item.is_measurable ? args.factorSigla : "N/A",
    match_type: args.matchType,
    confidence: args.confidence,
    justification: args.reasoning
      || `Item funcional identificado no processo ${candidate.process_ref}.`,
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
