/**
 * ImportacaoPreviewTable
 *
 * Refatoração visual conforme wireframe aprovado:
 *  - Contadores em grid 4 col, altura fixa h-24
 *  - Tabela com colunas de largura fixa (sem quebra de badge)
 *  - Footer de ações sticky bottom-0
 *  - Nenhuma alteração em lógica de negócio
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
  MinusCircle, Clock, Loader2,
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
  fila_atendimento:         "Fila Atendimento",
  planejamento_elaboracao:  "Em Elaboração",
  planejamento_ag_aprovacao:"Ag. Aprovação",
  planejamento_aprovada:    "Aprovada p/ Exec",
  em_execucao:              "Em Execução",
  bloqueada:                "Bloqueada",
  hom_ag_homologacao:       "Ag. Homologação",
  hom_homologada:           "Homologada",
  rejeitada:                "Rejeitada",
  fila_producao:            "Fila Produção",
  ag_aceite_final:          "Ag. Aceite Final",
  cancelada:                "Cancelada",
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
  novo:          { label: "Novo",           icon: PlusCircle,  pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  atualizacao:   { label: "Atualização",   icon: RefreshCw,   pill: "bg-sky-50 text-sky-700 border-sky-200" },
  sem_alteracao: { label: "Sem alteração", icon: MinusCircle, pill: "bg-gray-50 text-gray-500 border-gray-200" },
  erro_validacao:{ label: "Erro",           icon: XCircle,     pill: "bg-red-50 text-red-600 border-red-200" },
};

const ROW_STATUS_CONFIG: Record<
  RowStatus,
  { label: string; icon: React.ElementType; cls: string }
> = {
  pendente:    { label: "Pendente",    icon: Clock,        cls: "text-gray-400" },
  validando:   { label: "Validando…",  icon: Loader2,      cls: "text-amber-500" },
  atualizando: { label: "Migrando…",  icon: Loader2,      cls: "text-sky-500" },
  criado:      { label: "Criado",      icon: CheckCircle2, cls: "text-emerald-600" },
  atualizado:  { label: "Atualizado",  icon: CheckCircle2, cls: "text-sky-600" },
  ignorado:    { label: "Ignorado",    icon: MinusCircle,  cls: "text-gray-400" },
  erro:        { label: "Erro",        icon: XCircle,      cls: "text-red-500" },
};

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  rows:        PreviewRow[];
  onConfirm:   (selected: PreviewRow[]) => void;
  onCancel:    () => void;
  loading:     boolean;
  progressMap?: Map<string, RowStatus>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ImportacaoPreviewTable({
  rows, onConfirm, onCancel, loading, progressMap = new Map(),
}: Props) {
  const [enriched,     setEnriched]     = useState<EnrichedRow[]>([]);
  const [loadingEnrich, setLoadingEnrich] = useState(true);
  const [selectedRhms,  setSelectedRhms]  = useState<Set<string>>(new Set());

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
      } finally { setLoadingEnrich(false); }
    }
    enrich();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const displayRows = useMemo(
    () => enriched.map((r) => ({ ...r, status: progressMap.get(r.rhm) ?? r.status })),
    [enriched, progressMap],
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

  // ─── Loading state ──────────────────────────────────────────────────

  if (loadingEnrich) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">Comparando com o sistema…</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    // Container sem padding lateral — ocupa 100% da largura do card pai
    <div className="flex flex-col">

      {/* ── Contadores: grid 4 col, h-24 fixo, com padding lateral do card ── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-5 border-b border-gray-100">
        <Counter label="Novos"         count={counts.novos}        cls="bg-emerald-50 border-emerald-100 text-emerald-700" />
        <Counter label="Atualizações"  count={counts.atualizacoes} cls="bg-sky-50 border-sky-100 text-sky-700" />
        <Counter label="Sem alteração" count={counts.semAlteracao} cls="bg-gray-50 border-gray-200 text-gray-500" />
        <Counter label="Erros"         count={counts.erros}        cls="bg-red-50 border-red-100 text-red-600" />
      </div>

      {/* ── Tabela: largura total, sem padding lateral ── */}
      <div className="overflow-x-auto">
        <div className="max-h-[440px] overflow-y-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-100 hover:bg-gray-50">
                {/* w- fixos conforme wireframe */}
                <TableHead className="w-10 pl-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[90px]  text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-3">#</TableHead>
                <TableHead className="w-[160px] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Projeto</TableHead>
                <TableHead className="w-[140px] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status Planilha</TableHead>
                <TableHead className="w-[140px] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status Sistema</TableHead>
                <TableHead className="            text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Diferença</TableHead>
                <TableHead className="w-[130px] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Áção</TableHead>
                <TableHead className="w-[110px] text-[11px] font-semibold text-gray-500 uppercase tracking-wider pr-4">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => {
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
                      "border-b border-gray-50 transition-colors",
                      isSelected                       && "bg-blue-50/30",
                      !isSelectable                    && "opacity-50",
                      row.tipoAcao === "atualizacao"   && "border-l-2 border-l-amber-300",
                    )}
                  >
                    <TableCell className="pl-4 py-3.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => isSelectable && toggleRow(row.rhm)}
                        disabled={!isSelectable || loading}
                      />
                    </TableCell>

                    <TableCell className="font-mono text-sm font-semibold text-gray-700 py-3.5">
                      #{row.rhm}
                    </TableCell>

                    <TableCell className="text-sm text-gray-600 py-3.5 truncate" title={row.projeto}>
                      {row.projeto}
                    </TableCell>

                    {/* Status Planilha */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                        {labelSituacao(row.situacao)}
                      </span>
                    </TableCell>

                    {/* Status Sistema */}
                    <TableCell className="py-3.5">
                      {row.situacaoSistema ? (
                        <span className="inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                          {labelSituacao(row.situacaoSistema)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Não existe</span>
                      )}
                    </TableCell>

                    {/* Diferença */}
                    <TableCell className="text-xs py-3.5 pr-2">
                      {row.tipoAcao === "atualizacao" && row.diferenca ? (
                        <span className="text-amber-600 font-medium">{row.diferenca}</span>
                      ) : row.tipoAcao === "novo" ? (
                        <span className="text-emerald-600 font-medium">Será criado</span>
                      ) : (
                        <span className="text-gray-400">—</span>
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
      </div>

      {/* ── Legenda ── */}
      {counts.atualizacoes > 0 && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1.5 px-6 py-2 border-t border-gray-50">
          <span className="inline-block w-2.5 h-4 rounded-sm bg-amber-300 shrink-0" />
          Linhas com borda laranja possuem diferença de status entre planilha e sistema.
        </p>
      )}

      {/* ── Footer de ações: sticky bottom-0, sempre visível ── */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 px-6 py-4 border-t border-gray-100 bg-white">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-5 rounded-xl text-sm font-medium"
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
          className="h-9 px-5 rounded-xl text-sm font-medium border-gray-200 hover:border-gray-300"
          onClick={handleMigrarTodos}
          disabled={loading || selectableRhms.length === 0}
        >
          Migrar Todos ({selectableRhms.length})
        </Button>

        <Button
          variant="ghost"
          className="h-9 px-4 rounded-xl text-sm text-gray-400 hover:text-gray-700"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>

        <span className="text-xs text-gray-400 ml-auto">
          {counts.selecionados} de {selectableRhms.length} selecionado(s)
        </span>
      </div>
    </div>
  );
}

// ─── Counter ───────────────────────────────────────────────────────────────

function Counter({ label, count, cls }: { label: string; count: number; cls: string }) {
  return (
    // h-24 fixo: todos os 4 cards têm exatamente a mesma altura
    <div className={cn("h-24 rounded-xl border flex flex-col items-center justify-center", cls)}>
      <p className="text-3xl font-bold leading-none tabular-nums">{count}</p>
      <p className="text-[11px] font-medium mt-2 opacity-75">{label}</p>
    </div>
  );
}
