/**
 * KanbanFilterBar — Toolbar compacta em 2 linhas.
 * Linha 1: info da sprint selecionada.
 * Linha 2: busca + avatares + visões rápidas + botão Filtros + contador.
 */
import React, { useState, useMemo, useCallback } from "react";
import { X, BookmarkPlus, ChevronDown, Search, Filter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KanbanResponsavelFilter } from "@/shared/components/common/KanbanResponsavelFilter";
import type { ResponsavelFilterItem } from "@/shared/components/common/KanbanResponsavelFilter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface KanbanFiltros {
  membros: string[];
  tipo: string;
  prioridade: string;
  status: string;
  search: string;
  sprintId: string;
}

export const KANBAN_FILTROS_DEFAULT: KanbanFiltros = {
  membros: [],
  tipo: "all",
  prioridade: "all",
  status: "all",
  search: "",
  sprintId: "all",
};

export interface KanbanViewSalva {
  id: string;
  label: string;
  icon: string;
  filtros: KanbanFiltros;
}

const VIEWS_BUILTIN: KanbanViewSalva[] = [
  { id: "meus",      label: "Meus cards",  icon: "👤", filtros: { ...KANBAN_FILTROS_DEFAULT } },
  { id: "bugs",      label: "Bugs",        icon: "🐛", filtros: { ...KANBAN_FILTROS_DEFAULT, tipo: "bug" } },
  { id: "alta_prio", label: "Alta Prior.", icon: "🔥", filtros: { ...KANBAN_FILTROS_DEFAULT, prioridade: "alta" } },
  { id: "em_exec",   label: "Em Execução", icon: "⚡",  filtros: { ...KANBAN_FILTROS_DEFAULT, status: "in_progress" } },
];

const LS_KEY = "kanban_agil_views_salvas";
function loadViews(): KanbanViewSalva[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as KanbanViewSalva[]; }
  catch { return []; }
}
function saveViews(v: KanbanViewSalva[]) { localStorage.setItem(LS_KEY, JSON.stringify(v)); }

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const CHIP_COLORS: Record<string, string> = {
  tipo:       "text-violet-400 border-violet-400/40 bg-violet-400/10",
  prioridade: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  status:     "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
};

const CHIP_LABELS: Record<string, string> = {
  tipo:       "Tipo",
  prioridade: "Prioridade",
  status:     "Status",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const KanbanFilterBar = React.memo(function KanbanFilterBar({
  filtros,
  onChange,
  stories,
  developers,
  workflowColumns,
  sprints,
  totalFiltrado,
  currentUserId,
}: {
  filtros: KanbanFiltros;
  onChange: (f: KanbanFiltros) => void;
  stories: any[];
  developers: any[];
  workflowColumns: any[];
  sprints: any[];
  totalFiltrado: number;
  currentUserId?: string;
}) {
  const [viewsCustom, setViewsCustom] = useState<KanbanViewSalva[]>(loadViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const activeSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.isActive || s.is_active) ?? null,
    [sprints],
  );

  const huCountBySprint = useMemo(() => {
    const counts: Record<string, number> = {};
    stories.forEach((h: any) => {
      const sid = h.sprintId || h.sprint_id;
      if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
    });
    return counts;
  }, [stories]);

  const sprintsSorted = useMemo(() => {
    return [...(sprints ?? [])].sort((a: any, b: any) => {
      const aActive = a.isActive || a.is_active;
      const bActive = b.isActive || b.is_active;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.startDate || b.start_date || 0).getTime() -
             new Date(a.startDate || a.start_date || 0).getTime();
    });
  }, [sprints]);

  const selectedSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.id === filtros.sprintId) ?? null,
    [sprints, filtros.sprintId],
  );

  // Sprint info derivada para linha 1
  const sprintInfo = useMemo(() => {
    if (!selectedSprint) return null;
    const isActive  = selectedSprint.isActive || selectedSprint.is_active;
    const count     = huCountBySprint[selectedSprint.id] ?? 0;
    const startDate = selectedSprint.startDate || selectedSprint.start_date;
    const endDate   = selectedSprint.endDate   || selectedSprint.end_date;
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dateRange = startDate && endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : null;
    let delayDays = 0;
    if (isActive && endDate) {
      const diff = Math.floor((Date.now() - new Date(endDate).getTime()) / 86_400_000);
      if (diff > 0) delayDays = diff;
    }
    return { name: selectedSprint.name, isActive, count, dateRange, delayDays };
  }, [selectedSprint, huCountBySprint]);

  const responsaveisFilter = useMemo<ResponsavelFilterItem[]>(() => {
    const idsComStory = new Set<string>();
    stories.forEach((h: any) => {
      if (h.assigneeId) idsComStory.add(h.assigneeId);
      if (Array.isArray(h.assignees)) h.assignees.forEach((id: string) => idsComStory.add(id));
    });
    return (developers ?? [])
      .filter((d: any) => idsComStory.has(d.id))
      .map((d: any) => ({
        userId: d.id,
        name: d.name ?? "",
        avatarUrl: d.avatarUrl ?? d.avatar_url ?? null,
      } satisfies ResponsavelFilterItem));
  }, [stories, developers]);

  const counts = useMemo(() => {
    const tipoCounts: Record<string, number>   = {};
    const prioCounts: Record<string, number>   = {};
    const statusCounts: Record<string, number> = {};
    stories.forEach((h: any) => {
      if (h.type)     tipoCounts[h.type]     = (tipoCounts[h.type]     || 0) + 1;
      if (h.priority) prioCounts[h.priority] = (prioCounts[h.priority] || 0) + 1;
      if (h.status)   statusCounts[h.status] = (statusCounts[h.status] || 0) + 1;
    });
    return { tipoCounts, prioCounts, statusCounts };
  }, [stories]);

  const activeChips = useMemo(() => {
    const chips: { key: string; display: string }[] = [];
    if (filtros.tipo !== "all")       chips.push({ key: "tipo",       display: filtros.tipo });
    if (filtros.prioridade !== "all") chips.push({ key: "prioridade", display: filtros.prioridade });
    if (filtros.status !== "all") {
      const col = workflowColumns.find((c: any) => c.key === filtros.status);
      chips.push({ key: "status", display: col?.label ?? filtros.status });
    }
    return chips;
  }, [filtros, workflowColumns]);

  const advancedFilterCount = activeChips.length;

  const hasAnyFilter =
    filtros.membros.length > 0 ||
    filtros.tipo !== "all" ||
    filtros.prioridade !== "all" ||
    filtros.status !== "all" ||
    filtros.search !== "" ||
    filtros.sprintId !== "all";

  const clearChip = useCallback((key: string) => {
    setActiveViewId(null);
    onChange({ ...filtros, [key]: "all" });
  }, [filtros, onChange]);

  const clearAll = useCallback(() => {
    setActiveViewId(null);
    onChange({ ...KANBAN_FILTROS_DEFAULT, sprintId: activeSprint?.id ?? "all" });
  }, [activeSprint, onChange]);

  const applyView = useCallback((view: KanbanViewSalva) => {
    if (view.id === "meus" && currentUserId) {
      setActiveViewId(view.id);
      onChange({ ...KANBAN_FILTROS_DEFAULT, membros: [currentUserId], sprintId: filtros.sprintId });
      return;
    }
    setActiveViewId(view.id);
    onChange({ ...view.filtros, sprintId: filtros.sprintId });
  }, [currentUserId, filtros.sprintId, onChange]);

  const saveCurrentView = useCallback(() => {
    if (!saveLabel.trim()) return;
    const newView: KanbanViewSalva = {
      id: Date.now().toString(),
      label: saveLabel.trim(),
      icon: "📌",
      filtros: { ...filtros },
    };
    const updated = [...viewsCustom, newView];
    setViewsCustom(updated);
    saveViews(updated);
    setActiveViewId(newView.id);
    setSaveLabel("");
    setShowSaveInput(false);
  }, [saveLabel, filtros, viewsCustom]);

  const deleteView = useCallback((id: string) => {
    const updated = viewsCustom.filter((v) => v.id !== id);
    setViewsCustom(updated);
    saveViews(updated);
    if (activeViewId === id) setActiveViewId(null);
  }, [viewsCustom, activeViewId]);

  const allViews = [...VIEWS_BUILTIN, ...viewsCustom];

  const tipoItems = useMemo(() => [
    { value: "all", label: "Todos", count: stories.length },
    ...Object.entries(counts.tipoCounts).map(([v, c]) => ({ value: v, label: v, count: c })),
  ], [counts, stories]);

  const prioItems = useMemo(() => [
    { value: "all", label: "Todas", count: stories.length },
    ...Object.entries(counts.prioCounts).map(([v, c]) => ({ value: v, label: v, count: c })),
  ], [counts, stories]);

  const statusItems = useMemo(() => [
    { value: "all", label: "Todos", count: stories.length },
    ...workflowColumns
      .filter((c: any) => counts.statusCounts[c.key])
      .map((c: any) => ({ value: c.key, label: c.label, count: counts.statusCounts[c.key] ?? 0 })),
  ], [workflowColumns, counts, stories]);

  return (
    <div className="flex flex-col gap-2">

      {/* ── LINHA 1: Sprint info ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Dot de status */}
        {sprintInfo && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: sprintInfo.isActive ? "#22c55e" : "#94a3b8" }}
          />
        )}

        {/* Select de sprint */}
        <Select
          value={filtros.sprintId}
          onValueChange={(val) => {
            setActiveViewId(null);
            onChange({ ...filtros, sprintId: val });
          }}
        >
          <SelectTrigger className="h-8 text-xs w-auto min-w-[10rem] max-w-[16rem] border-border/60 font-semibold pr-8">
            <span className="whitespace-nowrap text-xs truncate">
              {filtros.sprintId === "all" ? "Todas as sprints" : (sprintInfo?.name ?? "")}
            </span>
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            <SelectItem value="all">
              <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span>📋</span><span>Todas as sprints</span>
              </span>
            </SelectItem>
            {sprintsSorted.map((s: any) => {
              const isActive = s.isActive || s.is_active;
              const count    = huCountBySprint[s.id] ?? 0;
              return (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <span>{isActive ? "🟢" : "⚫"}</span>
                    <span>{s.name}</span>
                    {isActive && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-400/20 text-amber-600 uppercase tracking-wide">
                        Ativa
                      </span>
                    )}
                    {count > 0 && (
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {count} HU{count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {sprintInfo && <span className="h-4 w-px bg-border shrink-0" />}

        {/* Datas */}
        {sprintInfo?.dateRange && (
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {sprintInfo.dateRange}
          </span>
        )}

        {/* Badge HU count */}
        {sprintInfo && sprintInfo.count > 0 && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted border border-border text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
            {sprintInfo.count} HU{sprintInfo.count !== 1 ? "s" : ""}
          </span>
        )}

        {/* Badge atraso */}
        {sprintInfo && sprintInfo.delayDays > 0 && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-600 whitespace-nowrap">
            {sprintInfo.delayDays}d atraso
          </span>
        )}

        {/* Badge encerrada */}
        {sprintInfo && !sprintInfo.isActive && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted border border-border text-[10px] text-muted-foreground whitespace-nowrap">
            🏁 Encerrada
          </span>
        )}
      </div>

      {/* ── LINHA 2: Busca + Avatares + Visões + Filtros + Contador ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Busca */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar card..."
            value={filtros.search}
            onChange={(e) => { setActiveViewId(null); onChange({ ...filtros, search: e.target.value }); }}
            className="pl-8 h-8 text-xs w-44"
          />
          {filtros.search && (
            <button
              onClick={() => onChange({ ...filtros, search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Avatares */}
        {responsaveisFilter.length > 0 && (
          <KanbanResponsavelFilter
            responsaveis={responsaveisFilter}
            selected={filtros.membros}
            onChange={(membros) => { setActiveViewId(null); onChange({ ...filtros, membros }); }}
          />
        )}

        <span className="h-4 w-px bg-border shrink-0" />

        {/* Visões rápidas */}
        {allViews.map((v) => (
          <ViewChip
            key={v.id}
            view={v}
            active={activeViewId === v.id}
            onApply={() => applyView(v)}
            onDelete={viewsCustom.find((c) => c.id === v.id) ? () => deleteView(v.id) : undefined}
          />
        ))}

        {/* Salvar filtro — só ícone com tooltip */}
        {!showSaveInput ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="h-7 w-7 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary flex items-center justify-center transition-colors shrink-0"
                >
                  <BookmarkPlus className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Salvar filtro atual como visão</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentView();
                if (e.key === "Escape") setShowSaveInput(false);
              }}
              placeholder="Nome da visão..."
              className="h-7 px-2 rounded-lg border border-primary/50 bg-background text-xs text-foreground focus:outline-none w-36"
            />
            <button
              onClick={saveCurrentView}
              className="h-7 px-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
            >
              OK
            </button>
            <button
              onClick={() => setShowSaveInput(false)}
              className="h-7 px-2 rounded-lg text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <span className="h-4 w-px bg-border shrink-0" />

        {/* Chips de filtros ativos (Tipo/Prior/Status) */}
        {activeChips.map((chip) => (
          <span
            key={chip.key}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium ${CHIP_COLORS[chip.key]}`}
          >
            <span className="text-muted-foreground/60 text-[10px]">{CHIP_LABELS[chip.key]}:</span>
            {chip.display}
            <button
              onClick={() => clearChip(chip.key)}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {/* Botão Filtros com badge de contagem */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary text-[12px] transition-colors shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filtros
              <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
              {advancedFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">
                  {advancedFilterCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 p-3 space-y-4">
            <FilterGroup
              label="Tipo"
              colorClass="text-violet-400"
              items={tipoItems}
              selected={filtros.tipo}
              onSelect={(v) => { onChange({ ...filtros, tipo: v }); setActiveViewId(null); }}
            />
            <FilterGroup
              label="Prioridade"
              colorClass="text-amber-400"
              items={prioItems}
              selected={filtros.prioridade}
              onSelect={(v) => { onChange({ ...filtros, prioridade: v }); setActiveViewId(null); }}
            />
            <FilterGroup
              label="Status"
              colorClass="text-cyan-400"
              items={statusItems}
              selected={filtros.status}
              onSelect={(v) => { onChange({ ...filtros, status: v }); setActiveViewId(null); }}
            />
          </PopoverContent>
        </Popover>

        {/* Limpar tudo */}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-3 w-3" /> Limpar tudo
          </button>
        )}

        {/* Contador — sempre à direita */}
        <span className="ml-auto text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          <span className="text-foreground font-semibold">{totalFiltrado}</span>{" "}
          demanda{totalFiltrado !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
});

// ─── ViewChip ────────────────────────────────────────────────────────────────

const ViewChip = React.memo(function ViewChip({ view, active, onApply, onDelete }: {
  view: KanbanViewSalva;
  active: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11px] font-medium cursor-pointer transition-all select-none ${
        active
          ? "bg-primary/15 border-primary/60 text-primary"
          : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
      onClick={onApply}
    >
      <span>{view.icon}</span>
      {view.label}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
});

// ─── FilterGroup ─────────────────────────────────────────────────────────────

const FilterGroup = React.memo(function FilterGroup({ label, colorClass, items, selected, onSelect }: {
  label: string;
  colorClass: string;
  items: { value: string; label: string; count: number }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${colorClass}`}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onSelect(item.value)}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] transition-all ${
              selected === item.value
                ? `${colorClass} border-current bg-current/10 font-semibold`
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            {item.label}
            <span className={`text-[9px] ${selected === item.value ? "opacity-80" : "opacity-50"}`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});
