import { useMemo } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodOption = "sprint-atual" | "ultimo-mes" | "ultimo-trimestre" | "custom";
export type ModuleOption = "todos" | "sala-agil" | "sustentacao" | "rdm";

export interface DashboardFilterValues {
  period: PeriodOption;
  teamId: string;
  module: ModuleOption;
}

interface TeamOption {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  filters: DashboardFilterValues;
  teams: TeamOption[];
  onChange: (filters: DashboardFilterValues) => void;
  onApply: () => void;
  loading?: boolean;
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  "sprint-atual": "Sprint atual",
  "ultimo-mes": "Último mês",
  "ultimo-trimestre": "Último trimestre",
  custom: "Personalizado",
};

const MODULE_LABELS: Record<ModuleOption, string> = {
  todos: "Todos os módulos",
  "sala-agil": "Sala Ágil",
  sustentacao: "Sustentação",
  rdm: "RDM",
};

export function DashboardFilters({
  filters,
  teams,
  onChange,
  onApply,
  loading = false,
}: DashboardFiltersProps) {
  const teamOptions = useMemo(
    () => [{ id: "all", name: "Todos os times" }, ...teams],
    [teams],
  );

  return (
    <div className="rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[180px_230px_230px_auto] xl:items-center">
        <Select
          value={filters.period}
          onValueChange={(value) =>
            onChange({ ...filters, period: value as PeriodOption })
          }
          disabled={loading}
        >
          <SelectTrigger className="h-10 w-full rounded-xl border-border/80 bg-background px-3 text-sm shadow-none">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
              <SelectItem key={key} value={key} className="text-sm">
                {PERIOD_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.teamId}
          onValueChange={(value) => onChange({ ...filters, teamId: value })}
          disabled={loading}
        >
          <SelectTrigger className="h-10 w-full rounded-xl border-border/80 bg-background px-3 text-sm shadow-none">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            {teamOptions.map((team) => (
              <SelectItem key={team.id} value={team.id} className="text-sm">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.module}
          onValueChange={(value) =>
            onChange({ ...filters, module: value as ModuleOption })
          }
          disabled={loading}
        >
          <SelectTrigger className="h-10 w-full rounded-xl border-border/80 bg-background px-3 text-sm shadow-none">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODULE_LABELS) as ModuleOption[]).map((key) => (
              <SelectItem key={key} value={key} className="text-sm">
                {MODULE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="h-10 rounded-xl border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary xl:justify-self-start"
          onClick={onApply}
          disabled={loading}
        >
          <Filter className="mr-2 h-4 w-4" />
          Aplicar filtros
        </Button>
      </div>
    </div>
  );
}
