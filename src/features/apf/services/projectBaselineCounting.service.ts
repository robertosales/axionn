import type { ProjectBaselineProcessCandidate } from "../types/apfRuntime.types";
import {
  buildSelectedBaselineItems,
  selectDeterministicBaselineItems,
} from "./projectBaselineItemSelection.service";

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
    if (!candidate) throw new Error("A IA não retornou uma seleção válida.");
    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }

  const refs = parsed.process_refs
    ?? parsed.processRefs
    ?? (parsed.process_ref ? [parsed.process_ref] : []);
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new Error("A IA não selecionou nenhum processo da baseline.");
  }

  return {
    processRefs: refs.map((ref: unknown) => String(ref).toUpperCase()),
    factorSigla: parsed.factor_sigla
      ? String(parsed.factor_sigla).toUpperCase()
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
  const selectedRefs = new Set(
    args.selectedProcessRefs.map((ref) => ref.toUpperCase()),
  );
  const selectedItemIds: string[] = [];

  for (const candidate of args.candidates) {
    if (!selectedRefs.has(candidate.process_ref.toUpperCase())) continue;
    const deterministic = selectDeterministicBaselineItems(
      args.evidence,
      candidate,
    );

    if (deterministic) {
      selectedItemIds.push(...deterministic.itemIds);
    } else if (candidate.items.length === 1) {
      selectedItemIds.push(candidate.items[0].id);
    } else {
      // Sem evidência suficiente para distinguir as linhas, preserva os itens
      // oficiais para decisão do analista em vez de inventar uma função.
      selectedItemIds.push(...candidate.items.map((item) => item.id));
    }
  }

  return buildSelectedBaselineItems({
    candidates: args.candidates,
    selectedItemIds,
    factorSigla: args.factorSigla,
    huRef: args.huRef,
    evidence: args.evidence,
    confidence: args.confidence,
    reasoning: args.reasoning,
    matchType: args.matchType,
  });
}
