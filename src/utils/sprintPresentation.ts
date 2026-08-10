export interface SprintDisplayName {
  title: string;
  reference: string | null;
}

export function getSprintDisplayName(name: string): SprintDisplayName {
  const normalized = name.trim();
  const match = normalized.match(/^(\d+)\s*-\s*(.+)$/);
  if (!match) return { title: normalized || "Sprint sem nome", reference: null };
  return { title: match[2].trim(), reference: `#${match[1]}` };
}

export function formatSprintDate(value?: string | null): string {
  if (!value) return "Data não informada";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function formatSprintPeriod(startDate?: string | null, endDate?: string | null): string {
  return `${formatSprintDate(startDate)} — ${formatSprintDate(endDate)}`;
}

export function formatSprintPoints(completed: number, total: number): string {
  return total > 0 ? `${completed} / ${total} pts` : "Sem pontos estimados";
}
