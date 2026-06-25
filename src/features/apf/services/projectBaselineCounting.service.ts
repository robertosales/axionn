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

function truncate(value: string, limit: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit)}…`;
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

export function buildCompactProcessSelectionPrompt(args: {
  storyText: string;
  candidates: ProjectBaselineProcessCandidate[];
  allowedFactors: string[];
  inferredFactor: string;
  minimal?: boolean;
}) {
  const processLimit = args.minimal ? 3 : 6;
  const itemLimit = args.minimal ? 1 : 3;
  const storyLimit = args.minimal ? 1600 : 3200;

  const candidateBlock = args.candidates
    .slice(0, processLimit)
    .map((candidate) => ({
      ref: candidate.process_ref,
      name: truncate(candidate.process_name, 140),
      score: Number(candidate.match_score),
      items: candidate.items.slice(0, itemLimit).map((item) => ({
        d: truncate(item.description, args.minimal ? 100 : 180),
        t: item.function_sigla,
        c: item.complexity,
        pf: Number(item.pf_bruto),
      })),
    }));

  return [
    "Tarefa: selecionar processos funcionais impactados por uma HU.",
    "A baseline pertence ao projeto. Selecione apenas refs presentes em CANDIDATOS.",
    "Não invente processo, tipo, peso ou item. A HU é gatilho, não unidade de contagem.",
    `Fator inicial sugerido: ${args.inferredFactor}. Use somente: ${args.allowedFactors.join(",")}.`,
    'Responda apenas JSON: {"process_refs":["EF000"],"factor_sigla":"A","confidence":0.0,"reasoning":"curto"}',
    `HU:${truncate(args.storyText, storyLimit)}`,
    `CANDIDATOS:${JSON.stringify(candidateBlock)}`,
  ].join("\n");
}

export function isAiPromptTooLarge(raw: unknown) {
  const message = String(raw ?? "").toLowerCase();
  return message.includes("request too large")
    || message.includes("tokens per minute")
    || message.includes("requested") && message.includes("limit")
    || message.includes("context_length")
    || message.includes("context length");
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
