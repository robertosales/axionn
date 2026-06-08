/**
 * ImportacaoPreviewTable
 *
 * - Dark mode: todas as classes hardcoded substituídas por tokens do design system
 * - Paginação client-side: 20 itens por página (opções 10 / 20 / 50)
 * - Seleção de checkboxes mantém estado global independente da página visível
 * - Nenhuma alteração em lógica de negócio
 */

import { useState, useMemo, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, RefreshCw, PlusCircle,
  MinusCircle, Clock, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface PreviewRow {
  rhm: string;
  projeto: string;
  teamId: string;
  situacao?: string;
  tipo: string;
  sla?: string;
  descricao?: string;
  data_previsao_encerramento?: string;
  prazo_inicio_atendimento?: string;
  prazo_solucao?: string;
  tipo_defeito?: string;
  originada_diagnostico?: boolean;
}

export type RowStatus =
  | "pendente" | "validando" | "atualizando"
  | "criado"   | "atualizado" | "ignorado" | "erro";

export type TipoAcao = "novo" | "atualizacao" | "sem_alteracao" | "erro_validacao";

interface SystemRecord { situacao: string; }

interface EnrichedRow extends PreviewRow {
  situacaoSistema: string | null;
  tipoAcao:        TipoAcao;
  diferenca:       string | null;
  status:          RowStatus;
}

// ─── Labels ───────────────────────────────────────────────────────────────

const SITUACAO_LABELS: Record<string, string> = {
  fila_atendimento:          "Fila Atendimento",
  planejamento_elaboracao:   "Em Elaboração",
  planejamento_ag_aprovacao: "Ag. Aprovação",
  planejamento_aprovada:     "Aprovada p/ Exec",
  em_execucao:               "Em Execução",
  bloqueada:                 "Bloqueada",
  hom_ag_homologacao:        "Ag. Homologação",
  hom_homologada:            "Homologada",
  rejeitada:                 "Rejeitada",
  fila_producao:             "Fila Produção",
  ag_aceite_final:           "Ag. Aceite Final",
  cancelada:                 "Cancelada",
  fila_concluida:            "Concluída",
};

function labelSituacao(s: string | null | undefined): string {
  if (!s) return "—";
  return SITUACAO_LABELS[s] ?? s;
}

// ─── Config de badges ─────────────────────────────────────────────────────

const TIPO_ACAO_CONFIG: Record<
  TipoAcao,
  { label: string; icon: React.ElementType; pill: string }
> = {
  novo:           { label: "Novo",           icon: PlusCircle,  pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  atualizacao:    { label: "Atualizar situação", icon: RefreshCw, pill: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" },
  sem_alteracao:  { label: "Sem alteração",  icon: MinusCircle, pill: "bg-muted text-muted-foreground border-border" },
  erro_validacao: { label: "Erro",           icon: XCircle,     pill: "bg-destructive/10 text-destructive border-destructive/20" },
};

const ROW_STATUS_CONFIG: Record<
  RowStatus,
  { label: string; icon: React.ElementType; cls: string }
> = {
  pendente:    { label: "Pendente",   icon: Clock,        cls: "text-muted-foreground" },
  validando:   { label: "Validando…", icon: Loader2,      cls: "text-amber-500 dark:text-amber-400" },
  atualizando: { label: "Migrando…",  icon: Loader2,      cls: "text-sky-500 dark:text-sky-400" },
  criado:      { label: "Criado",     icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  atualizado:  { label: "Atualizado", icon: CheckCircle2, cls: "text-sky-600 dark:text-sky-400" },
  ignorado:    { label: "Ignorado",   icon: MinusCircle,  cls: "text-muted-foreground" },
  erro:        { label: "Erro",       icon: XCircle,      cls: "text-destructive" },
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  rows:         PreviewRow[];
  onConfirm:    (selected: PreviewRow[]) => void;
  onCancel:     () => void;
  loading:      boolean;
  progressMap?: Map<string, RowStatus>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ImportacaoPreviewTable({
  rows, onConfirm, onCancel, loading, progressMap = new Map(),
}: Props) {
  const [enriched,      setEnriched]      = useState<EnrichedRow[]>([]);
  const [loadingEnrich, setLoadingEnrich] = useState(true);
  const [selectedRhms,  setSelectedRhms]  = useState<Set<string>>(new Set());

  // ─── Paginação ──────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState<PageSize>(20);

  // ─── Enriquecimento (compara com BD) ────────────────────────────────────

  useEffect(() => {
    if (rows.length === 0) { setLoadingEnrich(false); return; }
    async function enrich() {
      setLoadingEnrich(true);
      try {
        const byTeam = new Map<string, string[]>();
        for (const row of rows) {
          const list = byTeam.get(row.teamId) ?? [];
          list.push(row.rhm);
          byTeam.set(row.teamId, list);
        }
        const systemMap = new Map<string, SystemRecord>();
        for (const [teamId, rhms] of byTeam) {
          const { data } = await supabase
            .from("demandas" as any)
            .select("rhm, situacao")
            .eq("team_id", teamId)
            .in("rhm", rhms);
          if (data) for (const d of data as any[])
            systemMap.set(`${teamId}:${d.rhm}`, { situacao: d.situacao });
        }
        const result: EnrichedRow[] = rows.map((row) => {
          const sys = systemMap.get(`${row.teamId}:${row.rhm}`) ?? null;
          let tipoAcao: TipoAcao;
          let diferenca: string | null = null;
          if (!sys) {
            tipoAcao = "novo";
          } else if (sys.situacao !== row.situacao) {
            tipoAcao  = "atualizacao";
            diferenca = `"${labelSituacao(sys.situacao)}" → "${labelSituacao(row.situacao)}"`;
          } else {
            tipoAcao = "sem_alteracao";
          }
          return { ...row, situacaoSistema: sys?.situacao ?? null, tipoAcao, diferenca, status: "pendente" };
        });
        setEnriched(result);
        setSelectedRhms(new Set(
          result
            .filter((r) => r.tipoAcao === "novo" || r.tipoAcao === "atualizacao")
            .map((r) => r.rhm),
        ));
        setCurrentPage(1);
      } finally { setLoadingEnrich(false); }
    }
    enrich();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const displayRows = useMemo(
    () => enriched.map((r) => ({ ...r, status: progressMap.get(r.rhm) ?? r.status })),
    [enriched, progressMap],
  );

  // ─── Paginação derivada ──────────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const safePage     = Math.min(currentPage, totalPages);
  const pagedRows    = useMemo(
    () => displayRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [displayRows, safePage, pageSize],
  );

  const counts = useMemo(() => ({
    novos:        displayRows.filter((r) => r.tipoAcao === "novo").length,
    atualizacoes: displayRows.filter((r) => r.tipoAcao === "atualizacao").length,
    semAlteracao: displayRows.filter((r) => r.tipoAcao === "sem_alteracao").length,
    erros:        displayRows.filter((r) => r.tipoAcao === "erro_validacao").length,
    selecionados: selectedRhms.size,
  }), [displayRows, selectedRhms]);

  const selectableRhms = useMemo(
    () => displayRows.filter((r) => r.tipoAcao !== "erro_validacao").map((r) => r.rhm),
    [displayRows],
  );

  const allSelected  = selectableRhms.length > 0 && selectableRhms.every((r) => selectedRhms.has(r));
  const someSelected = selectedRhms.size > 0 && !allSelected;

  function toggleAll() {
    // Seleciona/deseleciona TODOS os registros (não só a página atual)
    setSelectedRhms(allSelected ? new Set() : new Set(selectableRhms));
  }
  function toggleRow(rhm: string) {
    setSelectedRhms((prev) => {
      const next = new Set(prev);
      if (next.has(rhm)) next.delete(rhm); else next.add(rhm);
      return next;
    });
  }
  function handleMigrarSelecionados() {
    onConfirm(enriched.filter((r) => selectedRhms.has(r.rhm)));
  }
  function handleMigrarTodos() {
    const all = enriched.filter((r) => r.tipoAcao !== "erro_validacao");
    setSelectedRhms(new Set(all.map((r) => r.rhm)));
    onConfirm(all);
  }
  function handlePageSizeChange(size: PageSize) {
    setPageSize(size);
    setCurrentPage(1);
  }

  // ─── Loading state ──────────────────────────────────────────────────

  if (loadingEnrich) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <p className="text-sm text-muted-foreground">Comparando com o sistema…</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">

      {/* ── Contadores ── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-5 border-b border-border">
        <Counter label="Novos"         count={counts.novos}        cls="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" />
        <Counter label="Atualizações"  count={counts.atualizacoes} cls="bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400" />
        <Counter label="Sem alteração" count={counts.semAlteracao} cls="bg-muted border-border text-muted-foreground" />
        <Counter label="Erros"         count={counts.erros}        cls="bg-destructive/10 border-destructive/20 text-destructive" />
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border hover:bg-muted/50">
              <TableHead className="w-10 pl-4 py-3">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                  onCheckedChange={toggleAll}
                  aria-label={`Selecionar todos (${selectableRhms.length})`}
                />
              </TableHead>
              <TableHead className="w-[90px]  text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3">#</TableHead>
              <TableHead className="w-[160px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projeto</TableHead>
              <TableHead className="w-[140px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status Planilha</TableHead>
              <TableHead className="w-[140px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status Sistema</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Resultado da Migração</TableHead>
              <TableHead className="w-[130px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ação</TableHead>
              <TableHead className="w-[110px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pr-4">Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => {
              const acfg         = TIPO_ACAO_CONFIG[row.tipoAcao];
              const scfg         = ROW_STATUS_CONFIG[row.status];
              const AIcon        = acfg.icon;
              const SIcon        = scfg.icon;
              const isSelectable = row.tipoAcao !== "erro_validacao";
              const isSelected   = selectedRhms.has(row.rhm);
              const isProcessing = row.status === "validando" || row.status === "atualizando";

              return (
                <TableRow
                  key={row.rhm}
                  className={cn(
                    "border-b border-border/50 transition-colors",
                    isSelected    && "bg-blue-500/5 dark:bg-blue-500/10",
                    !isSelectable && "opacity-50",
                    row.tipoAcao === "atualizacao" && "border-l-2 border-l-amber-400 dark:border-l-amber-500",
                  )}
                >
                  <TableCell className="pl-4 py-3.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => isSelectable && toggleRow(row.rhm)}
                      disabled={!isSelectable || loading}
                    />
                  </TableCell>

                  <TableCell className="font-mono text-sm font-semibold text-foreground py-3.5">
                    #{row.rhm}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground py-3.5 truncate" title={row.projeto}>
                    {row.projeto}
                  </TableCell>

                  {/* Status Planilha */}
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-400 font-medium">
                      {labelSituacao(row.situacao)}
                    </span>
                  </TableCell>

                  {/* Status Sistema */}
                  <TableCell className="py-3.5">
                    {row.situacaoSistema ? (
                      <span className="inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground font-medium">
                        {labelSituacao(row.situacaoSistema)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Não existe</span>
                    )}
                  </TableCell>

                  {/* Resultado da Migração */}
                  <TableCell className="text-xs py-3.5 pr-2">
                    {row.tipoAcao === "atualizacao" ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Atual:</span>
                          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium">
                            {labelSituacao(row.situacaoSistema)}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">→</span>
                          <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">Final:</span>
                          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold">
                            {labelSituacao(row.situacao)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground italic">
                          Situação do sistema será substituída pela situação da planilha.
                        </span>
                      </div>
                    ) : row.tipoAcao === "novo" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Será criado com situação:</span>
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold">
                          {labelSituacao(row.situacao)}
                        </span>
                      </span>
                    ) : row.tipoAcao === "sem_alteracao" ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        Situação mantida:
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border font-medium">
                          {labelSituacao(row.situacao)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Ação */}
                  <TableCell className="py-3.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap text-[11px] gap-1 px-2.5 py-1 rounded-full border font-medium",
                        acfg.pill,
                      )}
                    >
                      <AIcon className="h-3 w-3 shrink-0" />
                      {acfg.label}
                    </Badge>
                  </TableCell>

                  {/* Progresso */}
                  <TableCell className="py-3.5 pr-4">
                    <span className={cn(
                      "flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
                      scfg.cls,
                    )}>
                      <SIcon className={cn("h-3.5 w-3.5 shrink-0", isProcessing && "animate-spin")} />
                      {scfg.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Legenda ── */}
      <div className="px-6 py-2 border-t border-border/50 space-y-1">
        {counts.atualizacoes > 0 && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-4 rounded-sm bg-amber-400 dark:bg-amber-500 shrink-0" />
            Linhas destacadas terão a situação do sistema substituída pela situação da planilha.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground italic">
          A planilha é a fonte oficial. Em caso de divergência, a situação atual do sistema é sobrescrita pela situação da planilha.
        </p>
      </div>

      {/* ── Paginação ── */}
      {displayRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-border bg-muted/20">
          {/* Info e seletor de tamanho */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {displayRows.length} registro(s) — {counts.selecionados} selecionado(s)
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Por página:</span>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded transition-colors",
                    pageSize === size
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Navegação */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Página {safePage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Footer de ações ── */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 px-6 py-4 border-t border-border bg-card">
        <Button
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white h-9 px-5 rounded-xl text-sm font-medium"
          onClick={handleMigrarSelecionados}
          disabled={loading || counts.selecionados === 0}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Migrando…</>
          ) : (
            `Migrar Selecionados (${counts.selecionados})`
          )}
        </Button>

        <Button
          variant="outline"
          className="h-9 px-5 rounded-xl text-sm font-medium"
          onClick={handleMigrarTodos}
          disabled={loading || selectableRhms.length === 0}
        >
          Migrar Todos ({selectableRhms.length})
        </Button>

        <Button
          variant="ghost"
          className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Counter ───────────────────────────────────────────────────────────────

function Counter({ label, count, cls }: { label: string; count: number; cls: string }) {
  return (
    <div className={cn("h-24 rounded-xl border flex flex-col items-center justify-center", cls)}>
      <p className="text-3xl font-bold leading-none tabular-nums">{count}</p>
      <p className="text-[11px] font-medium mt-2 opacity-75">{label}</p>
    </div>
  );
}
