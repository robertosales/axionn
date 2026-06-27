import { GESP3_METRIC_PRECEDENTS } from "./gesp3MetricPrecedents";
import {
  extractOfficialHuRefs,
  storyTitleScope,
} from "./impactFactorResolution.service";

export const GESP3_IMPACT_FACTOR_VERSION = "v1";

export interface GESP3ImpactResolution {
  referenceCode: string;
  factorSigla: "I" | "A" | "N/A";
  functionSigla: "TRN" | "N/A";
  pfBruto: number;
  pfFs: number;
  isMeasurable: boolean;
  reason: string;
  notes?: string;
}

export function resolveGesp3ImpactFactor(
  storyText: string,
  projectContext: string,
): GESP3ImpactResolution | null {
  if (!/gesp\s*0?3|gesp3/i.test(projectContext)) return null;
  const referenceCode = extractOfficialHuRefs(storyTitleScope(storyText))[0];
  if (!referenceCode) return null;
  const precedent = GESP3_METRIC_PRECEDENTS.get(referenceCode);
  if (!precedent) return null;
  return {
    referenceCode,
    factorSigla: precedent.factorSigla,
    functionSigla: precedent.functionSigla,
    pfBruto: precedent.pfBruto,
    pfFs: precedent.pfFs,
    isMeasurable: precedent.isMeasurable,
    reason: precedent.isMeasurable
      ? `A medição oficial GESP3 da ${referenceCode} usa o fator ${precedent.factorSigla}.`
      : `A medição oficial GESP3 classifica ${referenceCode} como N/A.`,
    notes: precedent.notes,
  };
}
