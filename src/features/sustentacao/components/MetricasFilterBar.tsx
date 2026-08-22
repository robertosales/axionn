import { useState, useMemo } from "react";
import { X, Bookmark, BookmarkPlus, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { Demanda } from "../types/demanda";
import { SITUACAO_LABELS } from "../types/demanda";
import { useContracts } from "@/features/contracts/hooks/useContracts";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MetricasFiltros {
  projeto:     string;   // "all" | nome do projeto
  periodo:     string;   // "7" | "30" | "90" | "all"
  situacao:    string;   // "all" | chave de situacao
  membro:      string;   // "all" | display_name
  contract_id: string;   // "all" | uuid do contrato
}

export const FILTROS_DEFAULT: MetricasFiltros = {
  projeto:     "all",
  periodo:     "30",
  situacao:    "all",
  membro:      "all",
  contract_id: "all",
};

export interface ViewSalva {
  id:     string;
  label:  string;
  icon:   string;
  filtros: MetricasFiltros;
}

const VIEWS_BUILTIN: ViewSalva[] = [
  { id: "atrasados", label: "Atrasados",      icon: "", filtros: { ...FILTROS_DEFAULT, situacao: "bloqueada" } },
  { id: "ultimos7",  label: "Últimos 7 dias", icon: "", filtros: { ...FILTROS_DEFAULT, periodo: "7" } },
  { id: "ultimos30", label: "Últimos 30 dias",icon: "", filtros: { ...FILTROS_DEFAULT, periodo: "30" } },
];

const LS_KEY = "metricas_views_salvas";

function loadViewsFromLS(): ViewSalva[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") ?? []; }
  catch { return []; }
}

function saveViewsToLS(views: ViewSalva[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(views));
}

const PERIODO_LABELS: Record<string, string> = {
  "7": "7 dias", "30": "30 dias", "90": "90 dias", all: "Todos",
};

const CHIP_COLORS: Record<keyof MetricasFiltros, string> = {
  projeto:     "text-primary border-primary/40 bg-primary/10",
  periodo:     "text-info border-info/40 bg-info/10",
  situacao:    "text-warning border-warning/40 bg-warning/10",
  membro:      "text-success border-success/40 bg-success/10",
  contract_id: "text-primary border-primary/40 bg-primary/10",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function MetricasFilterBar({
  filtros,
  onChange,
  demandas,
  projetos,
  totalFiltrado,
}: {
  filtros:       MetricasFiltros;
  onChange:      (f: MetricasFiltros) => void;
  demandas:      Demanda[];
  projetos:      { id: string; nome: string }[];
  totalFiltrado: number;
}) {
  const [viewsCustom, setViewsCustom]   = useState<ViewSalva[]>(loadViewsFromLS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen]   = useState(false);
  const [saveLabel, setSaveLabel]       = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { contracts } = useContracts();

  const counts = useMemo(() => {
    const periodoItems = (dias: string) => {
      if (dias === "all") return demandas.length;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(dias));
      return demandas.filter((d) => new Date(d.created_at) >= cutoff).length;
    };
    const situacaoCounts: Record<string, number> = {};
    const membroCounts:   Record<string, number> = {};
    const projetoCounts:  Record<string, number> = {};
    const contractCounts: Record<string, number> = {};
    demandas.forEach((d) => {
      situacaoCounts[d.situacao] = (situacaoCounts[d.situacao] || 0) + 1;
      if (d.projeto) projetoCounts[d.projeto] = (projetoCounts[d.projeto] || 0) + 1;
      if (d.contract_id) contractCounts[d.contract_id] = (contractCounts[d.contract_id] || 0) + 1;
      const resp = (d as any).responsaveis_list as { nome: string }[] | undefined;
      resp?.forEach((r) => {
        if (r.nome) membroCounts[r.nome] = (membroCounts[r.nome] || 0) + 1;
      });
      if (!resp) {
        ([(d as any).responsavel_dev, (d as any).responsavel_requisitos,
          (d as any).responsavel_arquiteto, (d as any).responsavel_teste] as string[])
          .filter(Boolean).forEach((n) => { membroCounts[n] = (membroCounts[n] || 0) + 1; });
      }
    });
    return { periodoItems, situacaoCounts, membroCounts, projetoCounts, contractCounts };
  }, [demandas]);

  const activeChips = useMemo(() => {
    const chips: { key: keyof MetricasFiltros; label: string; display: string }[] = [];
    if (filtros.projeto     !== "all") chips.push({ key: "projeto",     label: "Projeto",  display: filtros.projeto });
    if (filtros.periodo     !== "all") chips.push({ key: "periodo",     label: "Período",  display: PERIODO_LABELS[filtros.periodo] ?? filtros.periodo });
    if (filtros.situacao    !== "all") chips.push({ key: "situacao",    label: "Status",   display: SITUACAO_LABELS[filtros.situacao] ?? filtros.situacao });
    if (filtros.membro      !== "all") chips.push({ key: "membro",      label: "Membro",   display: filtros.membro.split(" ")[0] });
    if (filtros.contract_id !== "all") {
      const name = contracts.find(c => c.id === filtros.contract_id)?.name ?? filtros.contract_id.slice(0, 8);
      chips.push({ key: "contract_id", label: "Contrato", display: name });
    }
    return chips;
  }, [filtros, contracts]);

  function clearChip(key: keyof MetricasFiltros) {
    setActiveViewId(null);
    onChange({ ...filtros, [key]: "all" });
  }

  function clearAll() {
    setActiveViewId(null);
    onChange(FILTROS_DEFAULT);
  }

  function applyView(view: ViewSalva) {
    setActiveViewId(view.id);
    onChange(view.filtros);
  }

  function saveCurrentView() {
    if (!saveLabel.trim()) return;
    const newView: ViewSalva = { id: Date.now().toString(), label: saveLabel.trim(), icon: "", filtros: { ...filtros } };
    const updated = [...viewsCustom, newView];
    setViewsCustom(updated);
    saveViewsToLS(updated);
    setActiveViewId(newView.id);
    setSaveLabel("");
    setShowSaveInput(false);
  }

  function deleteView(id: string) {
    const updated = viewsCustom.filter((v) => v.id !== id);
    setViewsCustom(updated);
    saveViewsToLS(updated);
    if (activeViewId === id) setActiveViewId(null);
  }

  const allViews    = [...VIEWS_BUILTIN, ...viewsCustom];
  const membros     = useMemo(() => Object.keys(counts.membroCounts).sort(), [counts]);
  const situacoes   = useMemo(() => Object.keys(counts.situacaoCounts).sort(), [counts]);

  return (
    <div className="flex flex-col gap-2">
      {/* Linha 1: visões salvas */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-1">Visões</span>
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
                  className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary sm:min-h-8"
                >
                  <BookmarkPlus className="h-3 w-3" /> Salvar filtro atual
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Salva os filtros ativos como visão rápida</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveCurrentView(); if (e.key === "Escape") setShowSaveInput(false); }}
              placeholder="Nome da visão..."
              className="min-h-11 w-40 border-primary/50 text-xs sm:min-h-8"
              aria-label="Nome da visão salva"
            />
            <button onClick={saveCurrentView} className="min-h-11 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground sm:min-h-8">OK</button>
            <button onClick={() => setShowSaveInput(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs text-muted-foreground hover:text-foreground sm:min-h-8 sm:min-w-8" aria-label="Cancelar criação da visão"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>

      {/* Linha 2: chips ativos + popover */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-1">Filtros</span>

        {activeChips.map((chip) => (
          <span
            key={chip.key}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium sm:min-h-8 ${CHIP_COLORS[chip.key]}`}
          >
            <span className="text-muted-foreground/60 text-[10px]">{chip.label}:</span>
            {chip.display}
            <button onClick={() => clearChip(chip.key)} className="ml-0.5 flex min-h-8 min-w-8 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100" aria-label={`Remover filtro ${chip.label}`}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary sm:min-h-8">
              <SlidersHorizontal className="h-3 w-3" /> Adicionar filtro
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 p-3 space-y-4">

            {/* Contrato */}
            {contracts.length > 0 && (
              <FilterGroup
                label="Contrato"
                colorClass="text-primary"
                items={[
                  { value: "all", label: "Todos", count: demandas.length },
                  ...contracts.map((c) => ({
                    value: c.id,
                    label: c.name,
                    count: counts.contractCounts[c.id] ?? 0,
                  })),
                ]}
                selected={filtros.contract_id}
                onSelect={(v) => { onChange({ ...filtros, contract_id: v }); setActiveViewId(null); }}
              />
            )}

            {/* Projeto */}
            <FilterGroup
              label="Projeto"
              colorClass="text-primary"
              items={[{ value: "all", label: "Todos", count: demandas.length }, ...projetos.map((p) => ({ value: p.nome, label: p.nome, count: counts.projetoCounts[p.nome] ?? 0 }))]}
              selected={filtros.projeto}
              onSelect={(v) => { onChange({ ...filtros, projeto: v }); setActiveViewId(null); }}
            />

            {/* Período */}
            <FilterGroup
              label="Período"
              colorClass="text-info"
              items={[
                { value: "all", label: "Todos",        count: counts.periodoItems("all") },
                { value: "7",   label: "Últimos 7d",   count: counts.periodoItems("7") },
                { value: "30",  label: "Últimos 30d",  count: counts.periodoItems("30") },
                { value: "90",  label: "Últimos 90d",  count: counts.periodoItems("90") },
              ]}
              selected={filtros.periodo}
              onSelect={(v) => { onChange({ ...filtros, periodo: v }); setActiveViewId(null); }}
            />

            {/* Status */}
            <FilterGroup
              label="Status"
              colorClass="text-warning"
              items={[{ value: "all", label: "Todos", count: demandas.length }, ...situacoes.map((s) => ({ value: s, label: SITUACAO_LABELS[s] ?? s, count: counts.situacaoCounts[s] ?? 0 }))]}
              selected={filtros.situacao}
              onSelect={(v) => { onChange({ ...filtros, situacao: v }); setActiveViewId(null); }}
            />

            {/* Membro */}
            {membros.length > 0 && (
              <FilterGroup
                label="Membro"
                colorClass="text-success"
                items={[{ value: "all", label: "Todos", count: demandas.length }, ...membros.map((m) => ({ value: m, label: m.split(" ")[0] + (m.split(" ")[1] ? " " + m.split(" ")[1][0] + "." : ""), count: counts.membroCounts[m] ?? 0 }))]}
                selected={filtros.membro}
                onSelect={(v) => { onChange({ ...filtros, membro: v }); setActiveViewId(null); }}
              />
            )}
          </PopoverContent>
        </Popover>

        {activeChips.length > 0 && (
          <button onClick={clearAll} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-8">
            <X className="h-3 w-3" /> Limpar
          </button>
        )}

        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground font-semibold">{totalFiltrado}</span> demanda{totalFiltrado !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function ViewChip({ view, active, onApply, onDelete }: {
  view: ViewSalva; active: boolean; onApply: () => void; onDelete?: () => void;
}) {
  return (
    <div className={`inline-flex min-h-11 items-center rounded-full border text-[11px] font-medium transition-colors sm:min-h-8 ${
      active
        ? "border-primary/60 bg-primary/15 text-primary"
        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
    }`}>
      <button onClick={onApply} className="flex min-h-11 items-center gap-1 rounded-l-full px-2.5 sm:min-h-8" aria-pressed={active}>
        <Bookmark className="h-3 w-3" aria-hidden="true" />
        {view.label}
      </button>
      {onDelete && (
        <button onClick={onDelete} className="flex min-h-11 min-w-9 items-center justify-center rounded-r-full opacity-50 transition-opacity hover:opacity-100 sm:min-h-8" aria-label={`Excluir visão ${view.label}`}>
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

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
            className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-2 text-[10px] transition-colors sm:min-h-8 ${
              selected === item.value
                ? `${colorClass} border-current bg-current/10 font-semibold`
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            {item.label}
            <span className={`text-[9px] ${ selected === item.value ? "opacity-80" : "opacity-50" }`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
