export interface OperationalStory {
  id: string;
  status: string;
  story_points: number | null;
}

export interface OperationalImpediment {
  id: string;
  resolved_at: string | null;
}

const DONE_STATUSES = new Set(["done", "concluido", "concluído", "closed", "encerrado", "pronto_para_publicacao"]);

export function isCompletedStory(status: string | null | undefined): boolean {
  return DONE_STATUSES.has(String(status ?? "").trim().toLocaleLowerCase("pt-BR"));
}

export function calculateOperationalMetric(
  code: string,
  stories: OperationalStory[],
  impediments: OperationalImpediment[],
): { value: number | null; itemsConsidered: number; metadata: Record<string, number>; reason?: string } {
  const completed = stories.filter((story) => isCompletedStory(story.status));
  if (code === "velocity") {
    if (!stories.length) return { value: null, itemsConsidered: 0, metadata: {}, reason: "Nenhuma HU encontrada no período" };
    return { value: completed.reduce((sum, story) => sum + Number(story.story_points ?? 0), 0), itemsConsidered: stories.length, metadata: { completed: completed.length, planned: stories.length } };
  }
  if (code === "sprint_commitment") {
    if (!stories.length) return { value: null, itemsConsidered: 0, metadata: {}, reason: "Nenhuma HU planejada no período" };
    return { value: completed.length / stories.length * 100, itemsConsidered: stories.length, metadata: { completed: completed.length, planned: stories.length } };
  }
  if (code === "throughput") {
    return { value: completed.length, itemsConsidered: stories.length, metadata: { completed: completed.length } };
  }
  if (code === "impediments_open") {
    const open = impediments.filter((impediment) => !impediment.resolved_at);
    return { value: open.length, itemsConsidered: impediments.length, metadata: { open: open.length, total: impediments.length } };
  }
  return { value: null, itemsConsidered: 0, metadata: {}, reason: "Métrica não suportada" };
}

export function cycleDateRange(cycle: string): { start: string; end: string } {
  const match = /^Q([1-4])\/(\d{4})$/.exec(cycle);
  if (!match) throw new Error("Ciclo inválido. Use Q1/AAAA até Q4/AAAA.");
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
