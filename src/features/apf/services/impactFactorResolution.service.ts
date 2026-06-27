export const IMPACT_FACTOR_RESOLUTION_VERSION = "official-history-v2";

export interface OfficialMeasurementItem {
  id: string;
  item_ref: string;
  process_ref: string | null;
  description: string;
  function_sigla: string;
  factor_sigla: string;
  pf_bruto: number;
  pf_fs: number;
  is_measurable: boolean;
  notes: string | null;
  product_reference: string | null;
  project_reference: string | null;
  measurement_reference: string | null;
}

export interface FactorPrecedent {
  hu_title: string | null;
  hu_text?: string | null;
  validated_factor_sigla: string | null;
  baseline_item_id: string | null;
}

export interface FactorResolution {
  sigla: string;
  source: string;
  reason: string;
  confidence: number;
  officialItemIds: string[];
  isNonCountable: boolean;
}

export const normalizeMetricText = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function extractOfficialHuRefs(value: unknown) {
  return [...String(value ?? "").matchAll(/\bHU\s*0*(\d+(?:\.\d+)?)\b/gi)]
    .map((match) => {
      const [integer, decimal] = match[1].split(".");
      return `HU${Number(integer)}${decimal ? `.${decimal}` : ""}`.toUpperCase();
    });
}

export function storyTitleScope(storyText: string) {
  return storyText.match(/(?:^|\n)Título:\s*([^\n]+)/i)?.[1]
    ?? storyText.split(/(?:Descrição:|Critérios? de Aceite:)/i)[0];
}

function itemSearchText(item: OfficialMeasurementItem) {
  return [
    item.item_ref,
    item.process_ref,
    item.description,
    item.product_reference,
    item.project_reference,
    item.measurement_reference,
  ].filter(Boolean).join(" ");
}

function similarity(left: unknown, right: unknown) {
  const stop = new Set(["para", "com", "dos", "das", "uma", "processo", "processos", "proc"]);
  const tokens = (value: unknown) => new Set(
    normalizeMetricText(value).split(/\s+/)
      .filter((token) => token.length > 2 && !stop.has(token)),
  );
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  return [...a].filter((token) => b.has(token)).length / Math.max(a.size, b.size);
}

export function officialFunctionSimilarity(storyText: string, item: OfficialMeasurementItem) {
  return similarity(storyTitleScope(storyText), item.description);
}

export function findOfficialMeasurementMatches(
  storyText: string,
  items: OfficialMeasurementItem[],
) {
  const storyRefs = new Set(extractOfficialHuRefs(storyTitleScope(storyText)));
  if (!storyRefs.size) return [];
  return items
    .filter((item) => extractOfficialHuRefs(itemSearchText(item))
      .some((ref) => storyRefs.has(ref)))
    .sort((a, b) => officialFunctionSimilarity(storyText, b)
      - officialFunctionSimilarity(storyText, a));
}

export function selectedBaselineIdsFromAnalysis(analysis: any): string[] {
  return Array.isArray(analysis?.processos)
    ? analysis.processos
      .map((process: any) => process?.selected_baseline_item_id)
      .filter((value: unknown): value is string => typeof value === "string" && Boolean(value))
    : [];
}
