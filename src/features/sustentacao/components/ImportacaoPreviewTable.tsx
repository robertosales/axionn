/**
 * ImportacaoPreviewTable
 *
 * Tabela comparativa de pré-validação para a tela de Importação Excel.
 * Exibe lado a lado: dados da planilha × situação atual no sistema.
 * Permite seleção individual, "Selecionar Todos" e ações de migração.
 *
 * Integração com ImportacaoView (pai):
 *  - rows           → linhas ParsedRow já validadas do CSV
 *  - onConfirm      → callback com as linhas selecionadas para migrar
 *  - onCancel       → fecha/limpa o preview
 *  - loading        → desabilita ações durante processamento
 *  - progressMap    → Map<rhm, RowStatus> atualizado pelo pai durante o processamento
 */

import { useState, useMemo, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────

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
  | "pendente"
  | "validando"
  | "atualizando"
  | "criado"
  | "atualizado"
  | "ignorado"
  | "erro";

export type TipoAcao = "novo" | "atualizacao" | "sem_alteracao" | "erro_validacao";

interface SystemRecord {
  situacao: string;
}

interface EnrichedRow extends PreviewRow {
  situacaoSistema: string | null;
  tipoAcao: TipoAcao;
  diferenca: string | null;
  status: RowStatus;
}

// ─── Labels / helpers ────────────────────────────────────────────────────────

const SITUACAO_LABELS: Record<string, string> = {
  fila_atendimento: "Fila Atendimento",
  planejamento_elaboracao: "Em Elaboração",
  planejamento_ag_aprovacao: "Ag. Aprovação",
  planejamento_aprovada: "Aprovada p/ Exec",
  em_execucao: "Em Execução",
  bloqueada: "Bloqueada",
  hom_ag_homologacao: "Ag. Homologação",
  hom_homologada: "Homologada",
  rejeitada: "Rejeitada",
  fila_producao: "Fila Produção",
  ag_aceite_final: "Ag. Aceite Final",
  cancelada: "Cancelada",
};

function labelSituacao(s: string | null | undefined): string {
  if (!s) return "—";
  return SITUACAO_LABELS[s] ?? s;
}

const TIPO_ACAO_CONFIG: Record<
  TipoAcao,
  { label: string; icon: React.ElementType; badgeClass: string }
> = {
  novo: {
    label: "Novo registro",
    icon: PlusCircle,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  atualizacao: {
    label: "Atualização",
    icon: RefreshCw,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  sem_alteracao: {
    label: "Sem alteração",
    icon: MinusCircle,
    badgeClass: "bg-gray-50 text-gray-500 border-gray-200",
  },
  erro_validacao: {
    label: "Erro de validação",
    icon: XCircle,
    badgeClass: "bg-red-50 text-red-600 border-red-200",
  },
};

const ROW_STATUS_CONFIG: Record<
  RowStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pendente:    { label: "Pendente",      icon: Clock,         className: "text-gray-400" },
  validando:   { label: "Validando…",    icon: Loader2,       className: "text-amber-500" },
  atualizando: { label: "Atualizando…",  icon: Loader2,       className: "text-sky-600" },
  criado:      { label: "Criado",        icon: CheckCircle2,  className: "text-emerald-600" },
  atualizado:  { label: "Atualizado",    icon: CheckCircle2,  className: "text-sky-600" },
  ignorado:    { label: "Ignorado",      icon: MinusCircle,   className: "text-gray-400" },
  erro:        { label: "Erro",          icon: XCircle,       className: "text-red-500" },
};

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  rows: PreviewRow[];
  onConfirm: (selected: PreviewRow[]) => void;
  onCancel: () => void;
  loading: boolean;
  progressMap?: Map<string, RowStatus>;
}

export function ImportacaoPreviewTable({
  rows,
  onConfirm,
  onCancel,
  loading,
  progressMap = new Map(),
}: Props) {
  const [enriched, setEnriched] = useState<EnrichedRow[]>([]);
  const [loadingEnrich, setLoadingEnrich] = useState(true);
  const [selectedRhms, setSelectedRhms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (rows.length === 0) {
      setLoadingEnrich(false);
      return;
    }

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

          if (data) {
            for (const d of data as any[]) {
              systemMap.set(`${teamId}:${d.rhm}`, { situacao: d.situacao });
            }
          }
        }

        const result: EnrichedRow[] = rows.map((row) => {
          const key = `${row.teamId}:${row.rhm}`;
          const sys = systemMap.get(key) ?? null;

          let tipoAcao: TipoAcao;
          let diferenca: string | null = null;

          if (!sys) {
            tipoAcao = "novo";
          } else if (sys.situacao !== row.situacao) {
            tipoAcao = "atualizacao";
            diferenca = `Situação: "${labelSituacao(sys.situacao)}" → "${labelSituacao(row.situacao)}"`;
          } else {
            tipoAcao = "sem_alteracao";
          }

          return {
            ...row,
            situacaoSistema: sys?.situacao ?? null,
            tipoAcao,
            diferenca,
            status: "pendente",
          };
        });

        setEnriched(result);

        const autoSelected = new Set(
          result
            .filter((r) => r.tipoAcao === "novo" || r.tipoAcao === "atualizacao")
            .map((r) => r.rhm),
        );
        setSelectedRhms(autoSelected);
      } finally {
        setLoadingEnrich(false);
      }
    }

    enrich();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const displayRows: EnrichedRow[] = useMemo(
    () =>
      enriched.map((r) => ({
        ...r,
        status: progressMap.get(r.rhm) ?? r.status,
      })),
    [enriched, progressMap],
  );

  const counts = useMemo(
    () => ({
      novos:        displayRows.filter((r) => r.tipoAcao === "novo").length,
      atualizacoes: displayRows.filter((r) => r.tipoAcao === "atualizacao").length,
      semAlteracao: displayRows.filter((r) => r.tipoAcao === "sem_alteracao").length,
      erros:        displayRows.filter((r) => r.tipoAcao === "erro_validacao").length,
      selecionados: selectedRhms.size,
    }),
    [displayRows, selectedRhms],
  );

  const selectableRhms = useMemo(
    () => displayRows.filter((r) => r.tipoAcao !== "erro_validacao").map((r) => r.rhm),
    [displayRows],
  );

  const allSelected =
    selectableRhms.length > 0 && selectableRhms.every((rhm) => selectedRhms.has(rhm));
  const someSelected = selectedRhms.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelectedRhms(new Set());
    } else {
      setSelectedRhms(new Set(selectableRhms));
    }
  }

  function toggleRow(rhm: string) {
    setSelectedRhms((prev) => {
      const next = new Set(prev);
      if (next.has(rhm)) next.delete(rhm);
      else next.add(rhm);
      return next;
    });
  }

  function handleMigrarSelecionados() {
    const selected = enriched.filter((r) => selectedRhms.has(r.rhm));
    onConfirm(selected);
  }

  function handleMigrarTodos() {
    const all = enriched.filter((r) => r.tipoAcao !== "erro_validacao");
    setSelectedRhms(new Set(all.map((r) => r.rhm)));
    onConfirm(all);
  }

  if (loadingEnrich) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <p>Comparando com o sistema… aguarde</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Painel de indicadores: 4 colunas pastéis ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryChip
          label="Novos"
          count={counts.novos}
          colorClass="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <SummaryChip
          label="Atualizações"
          count={counts.atualizacoes}
          colorClass="bg-sky-50 text-sky-700 border-sky-200"
        />
        <SummaryChip
          label="Sem alteração"
          count={counts.semAlteracao}
          colorClass="bg-gray-50 text-gray-500 border-gray-200"
        />
        <SummaryChip
          label="Erros"
          count={counts.erros}
          colorClass="bg-red-50 text-red-600 border-red-200"
        />
      </div>

      {/* ── Tabela comparativa ── */}
      <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 backdrop-blur-sm z-10">
              <TableRow className="border-b border-gray-100">
                <TableHead className="w-10 text-center py-3">
                  <Checkbox
                    checked={allSelected}
                    data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead className="w-20 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">#</TableHead>
                <TableHead className="min-w-[120px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Projeto</TableHead>
                <TableHead className="min-w-[130px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status Planilha</TableHead>
                <TableHead className="min-w-[130px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status Sistema</TableHead>
                <TableHead className="min-w-[200px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Diferença</TableHead>
                <TableHead className="min-w-[150px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Ação</TableHead>
                <TableHead className="min-w-[120px] py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => {
                const acaoCfg   = TIPO_ACAO_CONFIG[row.tipoAcao];
                const statusCfg = ROW_STATUS_CONFIG[row.status];
                const AcaoIcon   = acaoCfg.icon;
                const StatusIcon = statusCfg.icon;
                const isSelectable = row.tipoAcao !== "erro_validacao";
                const isSelected   = selectedRhms.has(row.rhm);
                const hasDiff      = row.tipoAcao === "atualizacao";
                const isProcessing =
                  row.status === "validando" || row.status === "atualizando";

                return (
                  <TableRow
                    key={row.rhm}
                    className={cn(
                      "transition-colors border-b border-gray-50",
                      isSelected   && "bg-blue-50/30",
                      !isSelectable && "opacity-55",
                      hasDiff      && "border-l-2 border-l-amber-300",
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="text-center py-3.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => isSelectable && toggleRow(row.rhm)}
                        disabled={!isSelectable || loading}
                        aria-label={`Selecionar demanda ${row.rhm}`}
                      />
                    </TableCell>

                    {/* # */}
                    <TableCell className="font-mono text-sm font-semibold text-gray-700 py-3.5">
                      #{row.rhm}
                    </TableCell>

                    {/* Projeto */}
                    <TableCell
                      className="text-sm text-gray-700 max-w-[140px] truncate py-3.5"
                      title={row.projeto}
                    >
                      {row.projeto}
                    </TableCell>

                    {/* Status Planilha */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                        {labelSituacao(row.situacao)}
                      </span>
                    </TableCell>

                    {/* Status Sistema */}
                    <TableCell className="py-3.5">
                      {row.situacaoSistema ? (
                        <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                          {labelSituacao(row.situacaoSistema)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Não existe</span>
                      )}
                    </TableCell>

                    {/* Diferença */}
                    <TableCell className="text-xs py-3.5">
                      {hasDiff && row.diferenca ? (
                        <span className="text-amber-600 font-medium">{row.diferenca}</span>
                      ) : row.tipoAcao === "novo" ? (
                        <span className="text-emerald-600 font-medium">Será criado</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>

                    {/* Tipo de Ação */}
                    <TableCell className="py-3.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] gap-1 px-2.5 py-1 rounded-full font-medium border",
                          acaoCfg.badgeClass
                        )}
                      >
                        <AcaoIcon className="h-3 w-3 shrink-0" />
                        {acaoCfg.label}
                      </Badge>
                    </TableCell>

                    {/* Progresso */}
                    <TableCell className="py-3.5">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          statusCfg.className,
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            isProcessing && "animate-spin",
                          )}
                        />
                        {statusCfg.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Legenda diferenças ── */}
      {counts.atualizacoes > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-4 rounded-sm bg-amber-300 shrink-0" />
          Linhas com borda laranja possuem diferença de status entre a planilha e o sistema.
        </p>
      )}

      {/* ── Barra de ações: hierarquia clara ── */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-9 rounded-lg text-sm font-medium transition-colors"
          onClick={handleMigrarSelecionados}
          disabled={loading || counts.selecionados === 0}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Migrando…
            </>
          ) : (
            `Migrar Selecionados (${counts.selecionados})`
          )}
        </Button>

        <Button
          variant="outline"
          className="h-9 px-5 rounded-lg text-sm font-medium border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          onClick={handleMigrarTodos}
          disabled={loading || selectableRhms.length === 0}
        >
          Migrar Todos ({selectableRhms.length})
        </Button>

        <Button
          variant="ghost"
          className="h-9 px-4 rounded-lg text-sm text-gray-500 hover:text-gray-700"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {counts.selecionados} de {selectableRhms.length} selecionado(s)
        </span>
      </div>
    </div>
  );
}

// ─── Sub-componente: chip de resumo ──────────────────────────────────────────

function SummaryChip({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-3 text-center", colorClass)}>
      <p className="text-2xl font-bold leading-none">{count}</p>
      <p className="text-[11px] mt-1.5 font-medium opacity-80">{label}</p>
    </div>
  );
}
