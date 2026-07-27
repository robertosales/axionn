export type OkrDirection = "increase" | "decrease" | "range";
export type OkrHealth = "on_track" | "attention" | "at_risk" | "no_data" | "completed";

export interface KrProgressInput {
  baseline: number | null;
  current: number | null;
  target?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  direction: OkrDirection;
}

export interface ProgressResult {
  rawProgress: number | null;
  progress: number | null;
  reason?: string;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function calculateKrProgress(input: KrProgressInput): ProgressResult {
  const { baseline, current, direction } = input;
  if (baseline === null || current === null) return { rawProgress: null, progress: null, reason: "Sem dados suficientes" };

  if (direction === "range") {
    const min = input.targetMin;
    const max = input.targetMax;
    if (min == null || max == null || min > max) return { rawProgress: null, progress: null, reason: "Faixa de meta inválida" };
    if (current >= min && current <= max) return { rawProgress: 100, progress: 100 };
    const target = baseline < min ? min : baseline > max ? max : (current < min ? min : max);
    const denominator = Math.abs(target - baseline);
    if (denominator === 0) return { rawProgress: 0, progress: 0, reason: "Resultado saiu da faixa esperada" };
    const raw = (1 - Math.abs(target - current) / denominator) * 100;
    return { rawProgress: raw, progress: clamp(raw) };
  }

  const target = input.target;
  if (target == null) return { rawProgress: null, progress: null, reason: "Meta não configurada" };
  if (baseline === target) {
    const achieved = direction === "increase" ? current >= target : current <= target;
    return { rawProgress: achieved ? 100 : 0, progress: achieved ? 100 : 0, reason: "Baseline igual à meta" };
  }
  const raw = direction === "increase"
    ? ((current - baseline) / (target - baseline)) * 100
    : ((baseline - current) / (baseline - target)) * 100;
  return { rawProgress: raw, progress: clamp(raw) };
}

export function calculateObjectiveProgress(
  keyResults: Array<{ progress: number | null; weight?: number | null; active?: boolean }>,
): ProgressResult {
  const measurable = keyResults.filter((kr) => kr.active !== false && kr.progress !== null);
  if (!measurable.length) return { rawProgress: null, progress: null, reason: "Nenhum Key Result medido" };
  const hasWeights = measurable.some((kr) => kr.weight != null);
  if (!hasWeights) {
    const raw = measurable.reduce((sum, kr) => sum + kr.progress!, 0) / measurable.length;
    return { rawProgress: raw, progress: clamp(raw) };
  }
  if (measurable.some((kr) => kr.weight == null || kr.weight! < 0)) {
    return { rawProgress: null, progress: null, reason: "Todos os KRs precisam de pesos válidos" };
  }
  const totalWeight = measurable.reduce((sum, kr) => sum + kr.weight!, 0);
  if (Math.abs(totalWeight - 100) > 0.01) return { rawProgress: null, progress: null, reason: "A soma dos pesos deve ser 100%" };
  const raw = measurable.reduce((sum, kr) => sum + kr.progress! * kr.weight! / 100, 0);
  return { rawProgress: raw, progress: clamp(raw) };
}

export function calculateObjectiveHealth(args: {
  progress: number | null;
  cycleElapsed: number;
  lifecycleStatus?: string;
}): { health: OkrHealth; reason: string } {
  if (args.lifecycleStatus === "completed") return { health: "completed", reason: "Objetivo concluído" };
  if (args.progress === null) return { health: "no_data", reason: "Não há Key Results medidos" };
  const elapsed = clamp(args.cycleElapsed);
  const gap = args.progress - elapsed;
  if (gap >= -10) return { health: "on_track", reason: `${elapsed}% do ciclo transcorrido e ${Math.round(args.progress)}% de progresso.` };
  if (gap >= -25) return { health: "attention", reason: `Progresso ${Math.abs(Math.round(gap))} pontos abaixo do ciclo.` };
  return { health: "at_risk", reason: `${elapsed}% do ciclo foi concluído, mas o objetivo atingiu ${Math.round(args.progress)}%.` };
}
