import type { ApfContext } from "../types/apfContext.types";
import type { BaselineCandidate } from "../types/apfRuntime.types";

export function parseClassification(raw: string): any[] {
  const text = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: any;

  try {
    parsed = JSON.parse(text);
  } catch {
    const starts = [text.indexOf("{"), text.indexOf("[")]
      .filter((position) => position >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    const candidate = start >= 0
      ? text.slice(start).match(/\{[\s\S]*\}/)?.[0]
        ?? text.slice(start).match(/\[[\s\S]*\]/)?.[0]
      : null;

    if (!candidate) throw new Error("A IA não retornou JSON válido.");
    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }

  const items = Array.isArray(parsed)
    ? parsed
    : parsed?.items
      ?? parsed?.efs
      ?? parsed?.functions
      ?? parsed?.result?.items
      ?? parsed?.data?.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("A IA não retornou itens de classificação.");
  }
  return items;
}

export function normalizeClassifiedItems(
  rawItems: any[],
  candidates: BaselineCandidate[],
  context: ApfContext,
  huRef: string,
): any[] {
  const allowedTypes = new Set([
    "N/A",
    ...context.function_types.map((item) => item.sigla.toUpperCase()),
  ]);
  const allowedFactors = new Set([
    "N/A",
    ...context.impact_factors.map((item) => item.sigla.toUpperCase()),
  ]);
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  return rawItems.slice(0, 12).map((raw) => {
    const functionSigla = String(raw.function_sigla ?? "N/A").toUpperCase();
    const factorSigla = String(raw.factor_sigla ?? "N/A").toUpperCase();

    if (!allowedTypes.has(functionSigla)) {
      throw new Error(`Tipo funcional inválido: ${functionSigla}`);
    }
    if (!allowedFactors.has(factorSigla)) {
      throw new Error(`Fator de impacto inválido: ${factorSigla}`);
    }

    const baselineItemId = raw.baseline_item_id
      && candidateMap.has(String(raw.baseline_item_id))
      ? String(raw.baseline_item_id)
      : null;
    const candidate = baselineItemId
      ? candidateMap.get(baselineItemId)
      : undefined;

    return {
      baseline_item_id: baselineItemId,
      hu_ref: String(raw.hu_ref ?? huRef),
      ef_description: String(
        raw.ef_description ?? candidate?.description ?? "Elemento funcional",
      ),
      function_sigla: functionSigla,
      factor_sigla: factorSigla,
      match_type: String(raw.match_type ?? (
        baselineItemId
          ? "baseline_similar"
          : functionSigla === "N/A"
            ? "non_measurable"
            : "ai_new_function"
      )),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
      justification: String(raw.justification ?? ""),
      evidence_literal: String(raw.evidence_literal ?? ""),
      category_sigla: raw.category_sigla ?? candidate?.category_sigla ?? null,
      complexity: String(raw.complexity ?? candidate?.complexity ?? "Padrão"),
    };
  });
}
