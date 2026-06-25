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

function primaryScope(storyText: string) {
  return normalize(
    storyText
      .split(/(?:critérios? de aceite|criterios? de aceite)/i)[0]
      .slice(0, 1800),
  );
}

export function inferImpactFactor(
  storyText: string,
  availableFactors: string[],
): string {
  const scope = primaryScope(storyText);
  const has = (sigla: string) => availableFactors.includes(sigla);

  // O fator descreve o objetivo principal da demanda. Palavras incidentais em
  // critérios de aceite (ex.: remover uma seleção) não caracterizam exclusão.
  const explicitExclusion = /\b(excluir|exclusao|remover|retirar|desativar)\b.{0,80}\b(funcionalidade|processo|campo|opcao|acao|tela|servico|arquivo)\b/.test(scope)
    || /\b(exclusao|desativacao)\s+(da|do|de)\b/.test(scope);
  if (explicitExclusion && has("E")) return "E";

  if (/\b(migrar|migracao|carga de dados)\b/.test(scope) && has("PMD")) {
    return "PMD";
  }
  if (/\b(corrigir|correcao|erro|bug|defeito)\b/.test(scope)) {
    if (has("COR50")) return "COR50";
    if (has("COR")) return "COR";
  }

  // Um item localizado na baseline já existe no projeto; portanto o impacto
  // inicial é alteração, salvo evidência explícita de outro fator contratual.
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
  requiresHumanReview?: boolean;
}) {
  const selectedRefs = new Set(
    args.selectedProcessRefs.map((ref) => ref.toUpperCase()),
  );
  const selectedItemIds: string[] = [];
  const reviewItemIds = new Set<string>();

  for (const candidate of args.candidates) {
    if (!selectedRefs.has(candidate.process_ref.toUpperCase())) continue;
    const deterministic = selectDeterministicBaselineItems(
      args.evidence,
      candidate,
    );

    if (deterministic) {
      selectedItemIds.push(...deterministic.itemIds);
      if (args.requiresHumanReview) {
        deterministic.itemIds.forEach((id) => reviewItemIds.add(id));
      }
    } else if (candidate.items.length === 1) {
      selectedItemIds.push(candidate.items[0].id);
      if (args.requiresHumanReview) reviewItemIds.add(candidate.items[0].id);
    } else {
      // O processo foi relacionado, mas a HU não diferencia as funções que o
      // compõem. Nenhuma delas deve virar PF automaticamente.
      for (const item of candidate.items) {
        selectedItemIds.push(item.id);
        reviewItemIds.add(item.id);
      }
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
  }).map((item) => reviewItemIds.has(item.baseline_item_id)
    ? {
      ...item,
      process_is_complete: false,
      process_is_independent: false,
      process_reasoning: args.requiresHumanReview
        ? "A resposta do provedor de IA não pôde ser utilizada. O candidato da baseline foi preservado para revisão humana, sem geração automática de PF."
        : "O processo foi relacionado, mas a HU não diferencia quais linhas funcionais foram impactadas. Revisão humana obrigatória.",
    }
    : item);
}
