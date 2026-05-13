import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SprintHistoryFilters, PeriodoFiltro } from "../hooks/useSprintHistory";

interface Props {
  filters: SprintHistoryFilters;
  teams: { id: string; name: string; module: string }[];
  onChange: (f: SprintHistoryFilters) => void;
}

export function SprintHistoryFiltersBar({ filters, teams, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={filters.teamId} onValueChange={v => onChange({ ...filters, teamId: v })}>
        <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Todos os times" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
          {teams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.periodo} onValueChange={v => onChange({ ...filters, periodo: v as PeriodoFiltro })}>
        <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="3m"  className="text-xs">Últimos 3 meses</SelectItem>
          <SelectItem value="6m"  className="text-xs">Últimos 6 meses</SelectItem>
          <SelectItem value="12m" className="text-xs">Últimos 12 meses</SelectItem>
          <SelectItem value="all" className="text-xs">Todo o histórico</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
