import {
  extractOfficialHuRefs,
  FactorPrecedent,
  FactorResolution,
  findOfficialMeasurementMatches,
  OfficialMeasurementItem,
  officialFunctionSimilarity,
  storyTitleScope,
} from "./impactFactorResolution.service";

export const FACTOR_DECISION_VERSION = "official-precedence-v2";

export function resolveImpactFactor(args: {
  storyText: string;
  availableFactors: string[];
  officialItems: OfficialMeasurementItem[];
  precedents: FactorPrecedent[];
  selectedBaselineItemIds?: string[];
}): FactorResolution {
  const available = new Set(args.availableFactors.map((value) => value.toUpperCase()));
  const valid = (value: unknown) => {
    const factor = String(value ?? "").toUpperCase();
    return available.has(factor) ? factor : null;
  };
  const exact = findOfficialMeasurementMatches(args.storyText, args.officialItems);
  const measurable = exact.filter((item) => item.is_measurable && item.function_sigla !== "N/A");

  if (exact.length && !measurable.length) {
    return {
      sigla: "N/A",
      source: "official_measurement_exact",
      reason: "A medição oficial classifica a HU como não mensurável.",
      confidence: 1,
      officialItemIds: exact.map((item) => item.id),
      isNonCountable: true,
    };
  }

  for (const item of measurable) {
    const factor = valid(item.factor_sigla);
    if (factor) {
      return {
        sigla: factor,
        source: "official_measurement_exact",
        reason: `A medição oficial da mesma HU usa o fator ${factor}.`,
        confidence: 1,
        officialItemIds: measurable.map((entry) => entry.id),
        isNonCountable: factor === "N/A",
      };
    }
  }

  const storyRefs = new Set(extractOfficialHuRefs(storyTitleScope(args.storyText)));
  for (const precedent of args.precedents) {
    const precedentRefs = extractOfficialHuRefs(
      `${precedent.hu_title ?? ""} ${precedent.hu_text ?? ""}`,
    );
    if (!precedentRefs.some((ref) => storyRefs.has(ref))) continue;
    const factor = valid(precedent.validated_factor_sigla);
    if (factor) {
      return {
        sigla: factor,
        source: "validated_history_exact",
        reason: `O histórico validado da mesma HU usa o fator ${factor}.`,
        confidence: 0.98,
        officialItemIds: precedent.baseline_item_id ? [precedent.baseline_item_id] : [],
        isNonCountable: factor === "N/A",
      };
    }
  }

  const selected = new Set(args.selectedBaselineItemIds ?? []);
  const exactFunction = args.officialItems
    .filter((item) => selected.has(item.id))
    .map((item) => ({ item, score: officialFunctionSimilarity(args.storyText, item) }))
    .sort((a, b) => b.score - a.score)[0];
  if (exactFunction?.score >= 0.72) {
    const factor = valid(exactFunction.item.factor_sigla);
    if (factor) {
      return {
        sigla: factor,
        source: "baseline_exact_function",
        reason: `A função homologada correspondente usa o fator ${factor}.`,
        confidence: exactFunction.score,
        officialItemIds: [exactFunction.item.id],
        isNonCountable: factor === "N/A",
      };
    }
  }

  const normalizedTitle = storyTitleScope(args.storyText).toLowerCase();
  if (/\b(excluir|exclusao|remover|retirar|desativar)\b/.test(normalizedTitle)
      && available.has("E")) {
    return {
      sigla: "E",
      source: "explicit_exclusion",
      reason: "O objetivo principal descreve exclusão funcional explícita.",
      confidence: 0.9,
      officialItemIds: [],
      isNonCountable: false,
    };
  }

  const fallback = available.has("I") ? "I" : args.availableFactors[0] ?? "N/A";
  return {
    sigla: fallback,
    source: available.has("I") ? "new_function_default" : "catalog_fallback",
    reason: available.has("I")
      ? "Sem precedente oficial exato de alteração, a função independente é tratada como inclusão."
      : `O catálogo não possui fator I; foi utilizado ${fallback}.`,
    confidence: available.has("I") ? 0.72 : 0.3,
    officialItemIds: [],
    isNonCountable: fallback === "N/A",
  };
}
