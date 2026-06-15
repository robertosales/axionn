// src/components/dashboard/DashboardFilters.tsx Refatorado
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Filter, X, RotateCcw } from "lucide-react";

export interface DashboardFilterState {
  sprintId: string;
  teamId: string;
  memberId: string;
  status: string;
  priority: string;
  activityType: string;
  dateFrom: string;
  dateTo: string;
}

export const INITIAL_FILTERS: DashboardFilterState = {
  sprintId: "active",
  teamId: "all",
  memberId: "all",
  status: "all",
  priority: "all",
  activityType: "all",
  dateFrom: "",
  dateTo: "",
};

interface Props {
  filters: DashboardFilterState;
  onChange: (filters: DashboardFilterState) => void;
  sprints: { id: string; name: string; isActive: boolean }[];
  teams: { id: string; name: string }[];
  members: { id: string; name: string }[];
  isAdmin: boolean;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os Status" },
  { value: "nao_iniciada", label: "Não Iniciada" },
  { value: "em_progresso", label: "Em Progresso" },
  { value: "concluida", label: "Concluída" },
  { value: "bloqueada", label: "Bloqueada" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: "all", label: "Todos os Tipos" },
  { value: "task", label: "Tarefa" },
  { value: "bug", label: "Bug" },
  { value: "architecture", label: "Arquitetura" },
  { value: "scrum", label: "Scrum" },
  { value: "requirements", label: "Requisitos" },
];

const FILTER_LABELS: Record<keyof DashboardFilterState, string> = {
  sprintId: "Sprint",
  teamId: "Time",
  memberId: "Membro",
  status: "Status",
  priority: "Prioridade",
  activityType: "Tipo",
  dateFrom: "De",
  dateTo: "Até",
};

export function DashboardFilters({ filters, onChange, sprints, teams, members, isAdmin }: Props) {
  const [expanded, setExpanded] = useState(true);

  const update = useCallback(
    (key: keyof DashboardFilterState, value: string) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange],
  );

  const activeFilters = Object.entries(filters).filter(([key, val]) => val !== (INITIAL_FILTERS as any)[key]);

  const reset = () => onChange({ ...INITIAL_FILTERS });

  const removeFilter = (key: keyof DashboardFilterState) => {
    onChange({ ...filters, [key]: (INITIAL_FILTERS as any)[key] });
  };

  const getFilterDisplayValue = (key: string, value: string): string => {
    if (key === "sprintId") {
      if (value === "active") return "Sprint Ativa";
      return sprints.find((s) => s.id === value)?.name || value;
    }
    if (key === "teamId") return teams.find((t) => t.id === value)?.name || value;
    if (key === "memberId") return members.find((m) => m.id === value)?.name || value;
    if (key === "status") return STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
    if (key === "priority") return PRIORITY_OPTIONS.find((o) => o.value === value)?.label || value;
    if (key === "activityType") return ACTIVITY_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
    return value;
  };

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Filter className="h-4 w-4 text-primary" />
            Filtros
            {activeFilters.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 px-1.5">
                {activeFilters.length}
              </Badge>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            {activeFilters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1 text-muted-foreground">
                <RotateCcw className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activeFilters.map(([key, val]) => (
              <Badge key={key} variant="secondary" className="text-xs gap-1 pr-1 pl-2 py-0.5">
                <span className="text-muted-foreground">{FILTER_LABELS[key as keyof DashboardFilterState]}:</span>
                {getFilterDisplayValue(key, val)}
                <button
                  onClick={() => removeFilter(key as keyof DashboardFilterState)}
                  className="ml-0.5 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {expanded && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <FilterSelect label="Sprint" value={filters.sprintId} onValueChange={(v) => update("sprintId", v)}>
              <SelectItem value="active">Sprint Ativa</SelectItem>
              <SelectItem value="all">Todas as Sprints</SelectItem>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.isActive ? "✦" : ""}
                </SelectItem>
              ))}
            </FilterSelect>

            {isAdmin && (
              <FilterSelect label="Time" value={filters.teamId} onValueChange={(v) => update("teamId", v)}>
                <SelectItem value="all">Todos os Times</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </FilterSelect>
            )}

            <FilterSelect label="Membro" value={filters.memberId} onValueChange={(v) => update("memberId", v)}>
              <SelectItem value="all">Todos</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect label="Status" value={filters.status} onValueChange={(v) => update("status", v)}>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect label="Prioridade" value={filters.priority} onValueChange={(v) => update("priority", v)}>
              {PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect label="Tipo" value={filters.activityType} onValueChange={(v) => update("activityType", v)}>
              {ACTIVITY_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </FilterSelect>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Data Início
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update("dateFrom", e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data Fim</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update("dateTo", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
