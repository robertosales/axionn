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
  "sprint-atual":     "Sprint Atual",
  "ultimo-mes":       "Último Mês",
  "ultimo-trimestre": "Último Trimestre",
  "custom":           "Personalizado",
};

const MODULE_LABELS: Record<ModuleOption, string> = {
  todos:        "Todos os módulos",
  "sala-agil":  "Sala Ágil",
  sustentacao:  "Sustentação",
  rdm:          "RDM",
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Período */}
      <Select
        value={filters.period}
        onValueChange={(v) => onChange({ ...filters, period: v as PeriodOption })}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-[155px] text-xs">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {PERIOD_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Time */}
      <Select
        value={filters.teamId}
        onValueChange={(v) => onChange({ ...filters, teamId: v })}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          {teamOptions.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Módulo */}
      <Select
        value={filters.module}
        onValueChange={(v) => onChange({ ...filters, module: v as ModuleOption })}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Módulo" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODULE_LABELS) as ModuleOption[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {MODULE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Aplicar — variant outline para seguir o padrão do design system */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={onApply}
        disabled={loading}
      >
        <Filter className="h-3.5 w-3.5" />
        Aplicar filtros
      </Button>
    </div>
  );
}
