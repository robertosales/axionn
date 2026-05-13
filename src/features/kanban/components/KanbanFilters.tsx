import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label }  from "@/components/ui/label";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import type { KanbanFilters } from "../hooks/useKanbanBoard";

const PRIORITY_LABELS: Record<string, string> = {
  high: "🔴 Alta", medium: "🟡 Média", low: "🟢 Baixa",
};

interface Props {
  filters:   KanbanFilters;
  onChange:  (f: KanbanFilters) => void;
  devs:      { id: string; name: string }[];
  epics:     { id: string; name: string; color: string }[];
  sprints:   { id: string; name: string }[];
  totalVisible: number;
}

export function KanbanFiltersBar({ filters, onChange, devs, epics, sprints, totalVisible }: Props) {
  const set = <K extends keyof KanbanFilters>(k: K, v: KanbanFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const isFiltered = filters.assigneeId !== "all" || filters.priority !== "all" ||
    filters.epicId !== "all" || filters.sprintId !== "active";

  const reset = () => onChange({ assigneeId: "all", priority: "all", epicId: "all", sprintId: "active", swimlane: filters.swimlane });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {/* Assignee */}
      <Select value={filters.assigneeId} onValueChange={v => set("assigneeId", v)}>
        <SelectTrigger className="h-7 text-[11px] w-36"><SelectValue placeholder="Assignee" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Todos os devs</SelectItem>
          {devs.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Prioridade */}
      <Select value={filters.priority} onValueChange={v => set("priority", v)}>
        <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Todas</SelectItem>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Epic */}
      {epics.length > 0 && (
        <Select value={filters.epicId} onValueChange={v => set("epicId", v)}>
          <SelectTrigger className="h-7 text-[11px] w-36"><SelectValue placeholder="Epic" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os epics</SelectItem>
            {epics.map(e => <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {/* Sprint */}
      <Select value={filters.sprintId} onValueChange={v => set("sprintId", v)}>
        <SelectTrigger className="h-7 text-[11px] w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="active" className="text-xs">⚡ Sprint ativo</SelectItem>
          <SelectItem value="all"    className="text-xs">Todos os sprints</SelectItem>
          {sprints.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Swimlane toggle */}
      <div className="flex items-center gap-1.5">
        <Switch id="swimlane" checked={filters.swimlane} onCheckedChange={v => set("swimlane", v)} className="scale-75" />
        <Label htmlFor="swimlane" className="text-[11px] cursor-pointer">Swimlane</Label>
      </div>

      {/* Reset */}
      {isFiltered && (
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={reset}>
          <RotateCcw className="h-3 w-3" /> Limpar
        </Button>
      )}

      <Badge variant="outline" className="text-[10px] ml-auto">{totalVisible} HUs</Badge>
    </div>
  );
}
