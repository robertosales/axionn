import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  X,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  User,
  ActivitySquare,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanResponsavelFilter } from "@/shared/components/common/KanbanResponsavelFilter";
import type { ResponsavelFilterItem } from "@/shared/components/common/KanbanResponsavelFilter";

import type { Demanda } from "../types/demanda";
import { SITUACAO_LABELS } from "../types/demanda";
export type { Demanda };

export const WORKFLOWLABELS: Record<string, string> = SITUACAO_LABELS;

// ── Helpers de tempo em coluna / horas ────────────────────────────────
function formatTimeInColumn(iso?: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "agora";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatHorasTotais(horas?: number | null): string {
  const h = Number(horas ?? 0);
  if (!h) return "0h";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

// Colunas padrão usadas como fallback quando workflowColumns não for passado
export const FLOWPRINCIPAL = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "hom_ag_homologacao",
  "hom_homologada",
  "fila_producao",
  "ag_aceite_final",
] as const;

const COLUMN_COLORS: Record<string, { hex: string }> = {
  fila_atendimento:          { hex: "#64748b" },
  planejamento_elaboracao:   { hex: "#3b82f6" },
  planejamento_ag_aprovacao: { hex: "#6366f1" },
  planejamento_aprovada:     { hex: "#8b5cf6" },
  em_execucao:               { hex: "#f59e0b" },
  bloqueada:                 { hex: "#ef4444" },
  hom_ag_homologacao:        { hex: "#06b6d4" },
  hom_homologada:            { hex: "#14b8a6" },
  rejeitada:                 { hex: "#f43f5e" },
  fila_producao:             { hex: "#f97316" },
  ag_aceite_final:           { hex: "#10b981" },
};

const PAPEL_COLORS: Record<string, string> = {
  desenvolvedor: "#3b82f6",
  analista:      "#10b981",
  arquiteto:     "#8b5cf6",
  testador:      "#f59e0b",
  gestor:        "#ec4899",
};

const PAPEL_LABELS: Record<string, string> = {
  desenvolvedor: "Desenvolvedor",
  analista:      "Analista",
  arquiteto:     "Arquiteto",
  testador:      "Testador",
  gestor:        "Gestor",
};

// ── Labels explícitas dos tipos conhecidos (com acentuação correta) ─────────────
const TIPO_LABELS: Record<string, string> = {
  corretiva:              "Corretiva",
  evolutiva:              "Evolutiva",
  manutencao_corretiva:   "Manutenção Corretiva",
  manutencao_preventiva:  "Manutenção Preventiva",
  manutencao_adaptativa:  "Manutenção Adaptativa",
  manutencao_perfectiva:  "Manutenção Perfectiva",
  incidente:              "Incidente",
  problema:               "Problema",
  mudanca:                "Mudança",
  requisicao:             "Requisição",
  projeto:                "Projeto",
  demanda:                "Demanda",
};

// Paleta de cores por tipo (ciclicamente reutilizada para tipos não mapeados)
const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  corretiva:              { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  evolutiva:              { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  manutencao_corretiva:   { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  manutencao_preventiva:  { bg: "rgba(99,102,241,0.12)",  text: "#6366f1" },
  manutencao_adaptativa:  { bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  manutencao_perfectiva:  { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
  incidente:              { bg: "rgba(244,63,94,0.12)",   text: "#f43f5e" },
  problema:               { bg: "rgba(249,115,22,0.12)",  text: "#f97316" },
  mudanca:                { bg: "rgba(20,184,166,0.12)",  text: "#14b8a6" },
  requisicao:             { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  projeto:                { bg: "rgba(236,72,153,0.12)",  text: "#ec4899" },
  demanda:                { bg: "rgba(100,116,139,0.12)", text: "#64748b" },
};

// Fallback universal: converte qualquer snake_case em "Title Case" legível
function tipoSnakeToLabel(tipo: string): string {
  if (!tipo) return "";
  if (TIPO_LABELS[tipo]) return TIPO_LABELS[tipo];
  return tipo
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function tipoGetStyle(tipo: string): { bg: string; text: string } {
  if (TIPO_COLORS[tipo]) return TIPO_COLORS[tipo];
  return { bg: "rgba(100,116,139,0.12)", text: "#64748b" };
}

// Interface para coluna de workflow dinâmica
export interface WorkflowColumn {
  key: string;
  label: string;
  color?: string;
  sort_order?: number;
}

function hexAlpha(hex: string, a: number) {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)},${a})`;
}

function slaDaysRemaining(demanda: Demanda): number | null {
  const prazo = (demanda as any).prazosolucao;
  if (!prazo) return null;
  const now = new Date();
  const dead = new Date(prazo);
  return Math.round((dead.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

import { getInitials, formatDisplayName } from "@/lib/nameUtils";

type RespItem = { papel: string; nome: string; created_at: string };

function getResponsaveisList(demanda: Demanda): RespItem[] {
  const lista = (demanda as any).responsaveis_list as RespItem[] | undefined;

  if (lista && lista.length > 0) {
    const seen = new Set<string>();
    return lista.filter((r) => {
      if (!r.nome || seen.has(r.nome)) return false;
      seen.add(r.nome);
      return true;
    });
  }

  const campos: [string, string | null | undefined][] = [
    ["desenvolvedor",  demanda.responsavel_dev],
    ["analista",       demanda.responsavel_requisitos],
    ["arquiteto",      demanda.responsavel_arquiteto],
    ["testador",       demanda.responsavel_teste],
  ];
  return campos
    .filter(([, nome]) => !!nome)
    .map(([papel, nome]) => ({ papel, nome: nome!, created_at: "" }));
}

// ── Avatar individual ────────────────────────────────────────────────
function ResponsavelAvatar({
  nome, papel, size = "sm", highlight = false,
}: { nome: string; papel: string; size?: "sm" | "md"; highlight?: boolean }) {
  const color = PAPEL_COLORS[papel] ?? "#64748b";
  const dim = size === "md" ? "h-6 w-6 text-[9px]" : "h-5 w-5 text-[8px]";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${dim} rounded-full flex items-center justify-center font-bold shrink-0 border-2 transition-transform hover:scale-110`}
            style={{
              backgroundColor: hexAlpha(color, 0.2),
              color,
              borderColor: highlight ? color : hexAlpha(color, 0.4),
              boxShadow: highlight ? `0 0 0 2px ${hexAlpha(color, 0.25)}` : undefined,
            }}
          >
            {getInitials(nome)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs py-1.5 px-2.5">
          <div className="font-semibold">{formatDisplayName(nome)}</div>
          <div className="text-muted-foreground mt-0.5">{PAPEL_LABELS[papel] ?? papel}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Grupo responsáveis expand/collapse ─────────────────────────────
function ResponsaveisGroup({ responsaveis }: { responsaveis: RespItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (responsaveis.length === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground/40">
        <User className="h-3 w-3" />
      </div>
    );
  }

  const ultimo = responsaveis[responsaveis.length - 1];
  const demais = responsaveis.slice(0, -1);
  const ultimoColor = PAPEL_COLORS[ultimo.papel] ?? "#64748b";

  if (!expanded) {
    return (
      <div className="flex items-center gap-1">
        <ResponsavelAvatar nome={ultimo.nome} papel={ultimo.papel} size="md" highlight />
        {demais.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                  className="h-5 min-w-[22px] px-1.5 rounded-full text-[8px] font-bold border transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: hexAlpha(ultimoColor, 0.1),
                    color: ultimoColor,
                    borderColor: hexAlpha(ultimoColor, 0.35),
                  }}
                >
                  +{demais.length} <ChevronDown className="inline h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px] space-y-0.5">
                <div className="font-semibold mb-1 text-muted-foreground">Outros responsáveis:</div>
                {demais.map((r, i) => (
                  <div key={`${r.nome}-${i}`} className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: PAPEL_COLORS[r.papel] ?? "#64748b" }} />
                    <span>{formatDisplayName(r.nome)}</span>
                    <span className="text-muted-foreground">· {PAPEL_LABELS[r.papel] ?? r.papel}</span>
                  </div>
                ))}
                <div className="text-muted-foreground mt-1 text-[10px]">Clique para ver todos</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-1.5 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Responsáveis</span>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="h-4 w-4 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>
      {responsaveis.map((r, i) => {
        const color = PAPEL_COLORS[r.papel] ?? "#64748b";
        const isUltimo = i === responsaveis.length - 1;
        return (
          <div key={`${r.nome}-${i}`} className="flex items-center gap-1.5 py-0.5">
            <ResponsavelAvatar nome={r.nome} papel={r.papel} size="sm" highlight={isUltimo} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-medium text-foreground truncate">
                {formatDisplayName(r.nome)}
              </span>
              <span className="text-[9px]" style={{ color: hexAlpha(color, 0.85) }}>
                {PAPEL_LABELS[r.papel] ?? r.papel}
              </span>
            </div>
            {isUltimo && (
              <span className="text-[8px] px-1 py-0.5 rounded border shrink-0"
                style={{ color, borderColor: hexAlpha(color, 0.3), background: hexAlpha(color, 0.08) }}>
                último
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Multi-select de projetos ────────────────────────────────────────
function ProjetoMultiSelect({
  projetos,
  selected,
  onChange,
}: {
  projetos: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (p: string) => {
    onChange(selected.includes(p) ? selected.filter((s) => s !== p) : [...selected, p]);
  };

  const label =
    selected.length === 0
      ? "Todos os projetos"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} projetos`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-lg border border-border bg-background text-sm flex items-center gap-2 hover:bg-muted transition-colors min-w-[160px] max-w-[240px]"
      >
        <span className="truncate flex-1 text-left text-foreground">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[280px] overflow-y-auto">
          <div className="px-2 pb-1 pt-0.5">
            <button
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-muted-foreground"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center ${
                selected.length === 0 ? "bg-primary border-primary" : "border-border"
              }`}>
                {selected.length === 0 && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </span>
              Todos
            </button>
          </div>
          <div className="border-t border-border/50 my-0.5" />
          {projetos.map((p) => (
            <button
              key={p}
              onClick={() => toggle(p)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm hover:bg-muted transition-colors text-foreground"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                selected.includes(p) ? "bg-primary border-primary" : "border-border"
              }`}>
                {selected.includes(p) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </span>
              <span className="truncate">{p}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

// ── Card da demanda ──────────────────────────────────────────────────
function DemandaCard({
  demanda, accentHex, visibleCols, currentIndex, onClick, onMove, onNovaAtividade,
}: {
  demanda: Demanda;
  accentHex: string;
  visibleCols: string[];
  currentIndex: number;
  onClick?: () => void;
  onMove?: (targetKey: string) => void;
  onNovaAtividade?: () => void;
}) {
  const slaD = slaDaysRemaining(demanda);
  const urgent = slaD !== null && slaD <= 3 && slaD >= 0;
  const late   = slaD !== null && slaD < 0;
  const responsaveis = getResponsaveisList(demanda);

  const colsAntes  = visibleCols.slice(0, currentIndex);
  const colsDepois = visibleCols.slice(currentIndex + 1);

  const tipoLabel = tipoSnakeToLabel(demanda.tipo);
  const tipoStyle = tipoGetStyle(demanda.tipo);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onClick}
          className="bg-card rounded-lg border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.15)] hover:border-border transition-all duration-150 overflow-hidden cursor-pointer select-none group"
        >
          <div className="h-0.5" style={{ backgroundColor: accentHex }} />
          <div className="p-3 flex flex-col gap-2">
            <p className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2">
              {demanda.descricao ?? demanda.tipo ?? "Demanda"}
            </p>
            {(demanda.rhm || demanda.projeto || demanda.tipo) && (
              <div className="flex flex-wrap gap-1">
                {demanda.rhm && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: hexAlpha(accentHex, 0.14), color: accentHex }}>
                    RHM {demanda.rhm}
                  </span>
                )}
                {demanda.projeto && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium truncate max-w-[140px]">
                    {demanda.projeto}
                  </span>
                )}
                {demanda.tipo && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: tipoStyle.bg, color: tipoStyle.text }}
                  >
                    {tipoLabel}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-start justify-between gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 pt-0.5">
                {late && (
                  <span className="flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/25">
                    <AlertTriangle className="h-2.5 w-2.5" /> SLA
                  </span>
                )}
                {urgent && !late && (
                  <span className="flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/25">
                    <Clock className="h-2.5 w-2.5" /> {slaD}d
                  </span>
                )}
                {slaD !== null && !urgent && !late && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" /> {slaD}d
                  </span>
                )}
                {onNovaAtividade && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNovaAtividade(); }}
                          className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <ActivitySquare className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Nova atividade</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex-1 min-w-0 flex justify-end">
                <ResponsaveisGroup responsaveis={responsaveis} />
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onClick}>Abrir detalhes</ContextMenuItem>
        {onNovaAtividade && (
          <ContextMenuItem onClick={(e) => { e.stopPropagation(); onNovaAtividade(); }}>
            <ActivitySquare className="h-3.5 w-3.5 mr-2 text-primary" />
            Nova atividade
          </ContextMenuItem>
        )}
        {onMove && (
          <>
            <ContextMenuSeparator />
            {colsDepois.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <ChevronsRight className="h-3.5 w-3.5 mr-2 text-emerald-500" />Avançar para
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-[50vh] overflow-y-auto w-52">
                  {colsDepois.map((key) => (
                    <ContextMenuItem key={key} onClick={() => onMove(key)}>
                      <span className="inline-block h-2 w-2 rounded-full mr-2 shrink-0"
                        style={{ background: COLUMN_COLORS[key]?.hex ?? "#6b7280" }} />
                      {WORKFLOWLABELS[key] ?? key}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            {colsAntes.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <ChevronsLeft className="h-3.5 w-3.5 mr-2 text-amber-500" />Regredir para
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-[50vh] overflow-y-auto w-52">
                  {[...colsAntes].reverse().map((key) => (
                    <ContextMenuItem key={key} onClick={() => onMove(key)}>
                      <span className="inline-block h-2 w-2 rounded-full mr-2 shrink-0"
                        style={{ background: COLUMN_COLORS[key]?.hex ?? "#6b7280" }} />
                      {WORKFLOWLABELS[key] ?? key}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />Mover para
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-[60vh] overflow-y-auto w-52">
                {visibleCols.map((key) => (
                  <ContextMenuItem key={key} disabled={key === demanda.situacao} onClick={() => onMove(key)}>
                    <span className="inline-block h-2 w-2 rounded-full mr-2 shrink-0"
                      style={{ background: COLUMN_COLORS[key]?.hex ?? "#6b7280" }} />
                    {WORKFLOWLABELS[key] ?? key}
                    {key === demanda.situacao && <span className="ml-auto text-[10px] text-muted-foreground">(atual)</span>}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function CollapsedCol({ label, count, accentHex, onClick }: { label: string; count: number; accentHex: string; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="flex-shrink-0 w-10 flex flex-col items-center rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-md transition-all py-3 gap-3"
      style={{ borderTop: `3px solid ${accentHex}` }}>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] font-bold flex-1 text-center leading-tight"
        style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", color: accentHex, letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span className="text-[10px] font-bold rounded-full min-w-[18px] text-center py-0.5 px-1"
        style={{ backgroundColor: hexAlpha(accentHex, 0.14), color: accentHex }}>
        {count}
      </span>
    </div>
  );
}

function ExpandedCol({ label, colKey, demandas, accentHex, visibleCols, onCollapse, onCardClick, onAdd, onMove, onNovaAtividade }: {
  label: string;
  colKey: string;
  demandas: Demanda[];
  accentHex: string;
  visibleCols: string[];
  onCollapse: () => void;
  onCardClick?: (d: Demanda) => void;
  onAdd?: () => void;
  onMove?: (demanda: Demanda, targetKey: string) => void;
  onNovaAtividade?: (demanda: Demanda) => void;
}) {
  const currentIndex = visibleCols.indexOf(colKey);

  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all"
      style={{ borderTop: `3px solid ${accentHex}` }}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <button onClick={onCollapse} className="p-0.5 rounded hover:bg-muted transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="flex-1 text-[12px] font-bold tracking-wide uppercase truncate" style={{ color: accentHex }}>{label}</span>
        <span className="text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center"
          style={{ backgroundColor: hexAlpha(accentHex, 0.14), color: accentHex }}>
          {demandas.length}
        </span>
        {onAdd && (
          <button onClick={onAdd} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-2 overflow-y-auto flex-1 space-y-2" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {demandas.length === 0 ? (
          <div className="flex items-center justify-center h-14 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
            Sem demandas
          </div>
        ) : (
          demandas.map((d) => (
            <DemandaCard
              key={d.id as string}
              demanda={d}
              accentHex={accentHex}
              visibleCols={visibleCols}
              currentIndex={currentIndex}
              onClick={() => onCardClick?.(d)}
              onMove={onMove ? (targetKey) => onMove(d, targetKey) : undefined}
              onNovaAtividade={onNovaAtividade ? () => onNovaAtividade(d) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

export interface SustentacaoBoardProps {
  demandas?: Demanda[];
  workflowColumns?: WorkflowColumn[];
  onSelectDemanda?: (demanda: Demanda, initialTab?: string) => void;
  onCreateDemanda?: (situacao?: string) => void;
  onMoveDemanda?: (demanda: Demanda, targetKey: string) => void;
}

export function SustentacaoBoard({
  demandas: demandasProp,
  workflowColumns,
  onSelectDemanda,
  onCreateDemanda,
  onMoveDemanda,
}: SustentacaoBoardProps) {
  const demandas = demandasProp ?? [];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedResp, setSelectedResp] = useState<string[]>([]);
  const [selectedProjetos, setSelectedProjetos] = useState<string[]>([]);

  const visibleCols = useMemo<string[]>(() => {
    if (workflowColumns && workflowColumns.length > 0) {
      return [...workflowColumns]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((c) => c.key);
    }
    return [...FLOWPRINCIPAL, "bloqueada", "rejeitada"] as string[];
  }, [workflowColumns]);

  const colLabels = useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = { ...WORKFLOWLABELS };
    if (workflowColumns) {
      workflowColumns.forEach((c) => { base[c.key] = c.label; });
    }
    return base;
  }, [workflowColumns]);

  const colColors = useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    Object.entries(COLUMN_COLORS).forEach(([k, v]) => { base[k] = v.hex; });
    if (workflowColumns) {
      workflowColumns.forEach((c) => { if (c.color) base[c.key] = c.color; });
    }
    return base;
  }, [workflowColumns]);

  const toggle = (key: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const projetosDisponiveis = useMemo<string[]>(() => {
    const set = new Set<string>();
    demandas.forEach((d) => { if (d.projeto) set.add(d.projeto); });
    return Array.from(set).sort();
  }, [demandas]);

  const responsaveisFilter = useMemo<ResponsavelFilterItem[]>(() => {
    const map = new Map<string, ResponsavelFilterItem>();
    demandas.forEach((d) => {
      const lista = getResponsaveisList(d);
      lista.forEach(({ papel, nome }) => {
        if (nome && !map.has(nome)) {
          map.set(nome, { userId: nome, name: nome, color: PAPEL_COLORS[papel] } as any);
        }
      });
    });
    return Array.from(map.values());
  }, [demandas]);

  const filtered = useMemo(() => {
    let items = demandas;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((d) =>
        String(d.descricao ?? "").toLowerCase().includes(q) ||
        String(d.projeto ?? "").toLowerCase().includes(q) ||
        String(d.rhm ?? "").toLowerCase().includes(q));
    }
    if (selectedProjetos.length > 0) {
      items = items.filter((d) => d.projeto && selectedProjetos.includes(d.projeto));
    }
    if (selectedResp.length > 0) {
      items = items.filter((d) => {
        const nomes = getResponsaveisList(d).map((r) => r.nome);
        return nomes.some((n) => selectedResp.includes(n));
      });
    }
    return items;
  }, [demandas, search, selectedProjetos, selectedResp]);

  const byStatus = useMemo(() => {
    const map: Record<string, Demanda[]> = {};
    visibleCols.forEach((k) => { map[k] = []; });
    filtered.filter(Boolean).forEach((d) => {
      const key = (d.situacao as string) ?? "fila_atendimento";
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [filtered, visibleCols]);

  const hasActiveFilters = selectedProjetos.length > 0 || selectedResp.length > 0;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 px-1 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar demanda..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {projetosDisponiveis.length > 0 && (
          <ProjetoMultiSelect
            projetos={projetosDisponiveis}
            selected={selectedProjetos}
            onChange={setSelectedProjetos}
          />
        )}
        {responsaveisFilter.length > 0 && (
          <KanbanResponsavelFilter
            responsaveis={responsaveisFilter}
            selected={selectedResp}
            onChange={setSelectedResp}
          />
        )}
        {hasActiveFilters && (
          <button
            onClick={() => { setSelectedProjetos([]); setSelectedResp([]); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </button>
        )}
        <Badge variant="outline" className="text-xs font-mono h-9 px-3">
          {filtered.length} demanda{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="flex gap-2 pb-4 overflow-x-auto flex-1" style={{ minHeight: 120 }}>
        {visibleCols.map((key) => {
          const label = colLabels[key] ?? key;
          const hex   = colColors[key] ?? "#94a3b8";
          const items = byStatus[key] ?? [];
          if (collapsed.has(key)) {
            return <CollapsedCol key={key} label={label} count={items.length} accentHex={hex} onClick={() => toggle(key)} />;
          }
          return (
            <ExpandedCol
              key={key}
              colKey={key}
              label={label}
              demandas={items}
              accentHex={hex}
              visibleCols={visibleCols}
              onCollapse={() => toggle(key)}
              onCardClick={(d) => onSelectDemanda?.(d)}
              onAdd={onCreateDemanda ? () => onCreateDemanda(key) : undefined}
              onMove={onMoveDemanda}
              onNovaAtividade={(d) => onSelectDemanda?.(d, "horas")}
            />
          );
        })}
      </div>
    </div>
  );
}
