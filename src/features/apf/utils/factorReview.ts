export interface FactorPreviewLine {
  send: boolean;
  functionSigla: string | null;
}

export interface FactorPreview {
  selectedProcesses: number;
  pfBruto: number;
  contributionPct: number;
  pfFs: number;
}

export function calculateFactorPreview(
  lines: FactorPreviewLine[],
  functionWeights: Record<string, number>,
  contributionPct: number,
): FactorPreview {
  const selected = lines.filter((line) => line.send);
  const pfBruto = selected.reduce(
    (total, line) => total + Number(functionWeights[line.functionSigla ?? ""] ?? 0),
    0,
  );
  const normalizedPct = Number.isFinite(contributionPct) ? contributionPct : 0;

  return {
    selectedProcesses: selected.length,
    pfBruto,
    contributionPct: normalizedPct,
    pfFs: pfBruto * normalizedPct / 100,
  };
}

export function factorWasOverridden(
  suggestedFactor: string | null | undefined,
  confirmedFactor: string | null | undefined,
): boolean {
  return (suggestedFactor ?? "").trim().toUpperCase()
    !== (confirmedFactor ?? "").trim().toUpperCase();
}

export function factorReviewIsValid(args: {
  suggestedFactor: string | null | undefined;
  confirmedFactor: string | null | undefined;
  overrideReason: string | null | undefined;
  selectedProcesses: number;
  hasMissingBaseline: boolean;
}): boolean {
  if (!args.confirmedFactor?.trim()) return false;
  if (args.selectedProcesses < 1 || args.hasMissingBaseline) return false;
  if (factorWasOverridden(args.suggestedFactor, args.confirmedFactor)) {
    return Boolean(args.overrideReason?.trim());
  }
  return true;
}
