/**
 * KanbanFilterBar — Filtro visual do Kanban Ágil.
 * Inclui seletor de sprint com badge de sprint ativa, visões salvas,
 * filter chips com contagem e contador de demandas.
 */
import { useState, useMemo } from "react";
import { X, BookmarkPlus, ChevronDown, SlidersHorizontal, Search, CalendarDays } from "lucide-react";
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

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface KanbanFiltros {
  membros: string[];   // user IDs; vazio = todos
  tipo: string;        // "all" | story type
  prioridade: string;  // "all" | priority
  status: string;      // "all" | column key
  search: string;      // texto livre
  sprintId: string;    // "all" | sprint UUID
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
  { id: "em_exec",   label: "Em Execução", icon: "⚡", filtros: { ...KANBAN_FILTROS_DEFAULT, status: "in_progress" } },
];

const LS_KEY = "kanban_agil_views_salvas";
function loadViews(): KanbanViewSalva[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as KanbanViewSalva[]; }
  catch { return []; }
}
function saveViews(v: KanbanViewSalva[]) { localStorage.setItem(LS_KEY, JSON.stringify(v)); }

// ─── Helpers visuais ─────────────────────────────────────────────────────────

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

export function KanbanFilterBar({
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

  // ── Sprint ativa do time ──
  const activeSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.isActive || s.is_active) ?? null,
    [sprints],
  );

  // ── Contagem de HUs por sprint ──
  const huCountBySprint = useMemo(() => {
    const counts: Record<string, number> = {};
    stories.forEach((h: any) => {
      const sid = h.sprintId || h.sprint_id;
      if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
    });
    return counts;
  }, [stories]);

  // ── Sprints ordenadas: ativa primeiro, depois mais recentes ──
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

  // ── Sprint selecionada ──
  const selectedSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.id === filtros.sprintId) ?? null,
    [sprints, filtros.sprintId],
  );

  // ── Label completo da opção selecionada (para dimensionar o trigger) ──
  const selectedLabel = useMemo(() => {
    if (filtros.sprintId === "all") return "📋 Todas as sprints";
    const s = selectedSprint;
    if (!s) return "";
    const isActive = s.isActive || s.is_active;
    const count    = huCountBySprint[s.id] ?? 0;
    const emoji    = isActive ? "🟢" : "⚫";
    const ativa    = isActive ? " • Ativa" : "";
    const hus      = count > 0 ? ` • ${count} HU${count !== 1 ? "s" : ""}` : "";
    return `${emoji} ${s.name}${ativa}${hus}`;
  }, [filtros.sprintId, selectedSprint, huCountBySprint]);

  // ── Monta lista de responsáveis ──
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

  // ── Contagens dinâmicas ──
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

  // ── Chips ativos ──
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

  const hasAnyFilter =
    filtros.membros.length > 0 ||
    filtros.tipo !== "all" ||
    filtros.prioridade !== "all" ||
    filtros.status !== "all" ||
    filtros.search !== "" ||
    filtros.sprintId !== "all";

  function clearChip(key: string) {
    setActiveViewId(null);
    onChange({ ...filtros, [key]: "all" });
  }
  function clearAll() {
    setActiveViewId(null);
    onChange({ ...KANBAN_FILTROS_DEFAULT, sprintId: activeSprint?.id ?? "all" });
  }
  function applyView(view: KanbanViewSalva) {
    if (view.id === "meus" && currentUserId) {
      setActiveViewId(view.id);
      onChange({ ...KANBAN_FILTROS_DEFAULT, membros: [currentUserId], sprintId: filtros.sprintId });
      return;
    }
    setActiveViewId(view.id);
    onChange({ ...view.filtros, sprintId: filtros.sprintId });
  }
  function saveCurrentView() {
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
  }
  function deleteView(id: string) {
    const updated = viewsCustom.filter((v) => v.id !== id);
    setViewsCustom(updated);
    saveViews(updated);
    if (activeViewId === id) setActiveViewId(null);
  }

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
    <div className="flex flex-col gap-2.5">

      {/* ── Linha 0: Seletor de Sprint ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Sprint</span>

        <Select
          value={filtros.sprintId}
          onValueChange={(val) => {
            setActiveViewId(null);
            onChange({ ...filtros, sprintId: val });
          }}
        >
          {/*
            w-auto + min-w-[12rem]: o trigger cresce com o texto,
            respeitando um mínimo legível e sem cortar nomes longos.
          */}
          <SelectTrigger className="h-8 text-xs w-auto min-w-[12rem] border-border/60 pr-8">
            <span className="whitespace-nowrap text-xs">{selectedLabel}</span>
          </SelectTrigger>

          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {/* Opção: todas as sprints */}
            <SelectItem value="all">
              <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span>📋</span>
                <span>Todas as sprints</span>
              </span>
            </SelectItem>

            {/* Opções por sprint */}
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

        {/* Badge sprint em andamento */}
        {selectedSprint && (selectedSprint.isActive || selectedSprint.is_active) && (
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-600 text-[10px] font-semibold">
            🏃 Sprint em andamento
          </span>
        )}

        {/* Badge sprint encerrada */}
        {selectedSprint && !selectedSprint.isActive && !selectedSprint.is_active && (
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-400/15 border border-slate-400/40 text-slate-500 text-[10px] font-medium">
            🏁 Encerrada
          </span>
        )}
      </div>

      {/* ── Linha 1: Visões salvas ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-1 shrink-0">Visões</span>
        {allViews.map((v) => (
          <ViewChip
            key={v.id}
            view={v}
            active={activeViewId === v.id}
            onApply={() => applyView(v)}
            onDelete={viewsCustom.find((c) => c.id === v.id) ? () => deleteView(v.id) : undefined}
          />
        ))}
        {!showSaveInput ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="h-7 px-2 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary text-[11px] flex items-center gap-1 transition-colors"
                >
                  <BookmarkPlus className="h-3 w-3" /> Salvar filtro
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Salva os filtros ativos como visão rápida</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveCurrentView(); if (e.key === "Escape") setShowSaveInput(false); }}
              placeholder="Nome da visão..."
              className="h-7 px-2 rounded-lg border border-primary/50 bg-background text-xs text-foreground focus:outline-none w-36"
            />
            <button onClick={saveCurrentView} className="h-7 px-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">OK</button>
            <button onClick={() => setShowSaveInput(false)} className="h-7 px-2 rounded-lg text-muted-foreground hover:text-foreground text-xs"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>

      {/* ── Linha 2: Busca + avatares de membros ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
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

        {responsaveisFilter.length > 0 && (
          <KanbanResponsavelFilter
            responsaveis={responsaveisFilter}
            selected={filtros.membros}
            onChange={(membros) => { setActiveViewId(null); onChange({ ...filtros, membros }); }}
          />
        )}
      </div>

      {/* ── Linha 3: Chips ativos + Filtrar + contador ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeChips.map((chip) => (
          <span
            key={chip.key}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium ${CHIP_COLORS[chip.key]}`}
          >
            <span className="text-muted-foreground/60 text-[10px]">{CHIP_LABELS[chip.key]}:</span>
            {chip.display}
            <button onClick={() => clearChip(chip.key)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary text-[11px] transition-colors">
              <SlidersHorizontal className="h-3 w-3" /> Tipo / Prior / Status
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 p-3 space-y-4">
            <FilterGroup label="Tipo"       colorClass="text-violet-400" items={tipoItems}   selected={filtros.tipo}       onSelect={(v) => { onChange({ ...filtros, tipo: v });       setActiveViewId(null); }} />
            <FilterGroup label="Prioridade" colorClass="text-amber-400"  items={prioItems}   selected={filtros.prioridade} onSelect={(v) => { onChange({ ...filtros, prioridade: v }); setActiveViewId(null); }} />
            <FilterGroup label="Status"     colorClass="text-cyan-400"   items={statusItems} selected={filtros.status}     onSelect={(v) => { onChange({ ...filtros, status: v });     setActiveViewId(null); }} />
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <button onClick={clearAll} className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" /> Limpar tudo
          </button>
        )}

        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground font-semibold">{totalFiltrado}</span> demanda{totalFiltrado !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ─── ViewChip ─────────────────────────────────────────────────────────────────

function ViewChip({ view, active, onApply, onDelete }: {
  view: KanbanViewSalva; active: boolean; onApply: () => void; onDelete?: () => void;
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
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ─── FilterGroup ──────────────────────────────────────────────────────────────

function FilterGroup({ label, colorClass, items, selected, onSelect }: {
  label: string; colorClass: string;
  items: { value: string; label: string; count: number }[];
  selected: string; onSelect: (v: string) => void;
}) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${colorClass}`}>{label}</p>
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
            <span className={`text-[9px] ${selected === item.value ? "opacity-80" : "opacity-50"}`}>{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
