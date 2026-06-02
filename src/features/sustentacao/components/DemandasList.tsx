import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MoreHorizontal, Plus, Search, ListTodo, LayoutGrid, LayoutList,
  User, Tag, Loader2, ChevronLeft, ChevronRight, FileText,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useDemandasPaginadas } from "../hooks/useDemandasPaginadas";
import { useDemandaMutations } from "../hooks/useDemandaMutations";
import { useResponsaveis } from "../hooks/useResponsaveis";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DemandaForm } from "./DemandaForm";
import { DemandaDetail } from "./DemandaDetail";
import { SITUACAO_LABELS, SITUACAO_COLORS, isDemandaIniciada } from "../types/demanda";
import type { Demanda } from "../types/demanda";
import { getTipoLabel } from "../types/imr";
import { cn } from "@/lib/utils";

const SITUACAO_PAPEL_MAP: Record<string, string> = {
  fila_atendimento:           "analista",
  planejamento_elaboracao:    "analista",
  planejamento_ag_aprovacao:  "analista",
  planejamento_aprovada:      "analista",
  em_execucao:                "desenvolvedor",
  bloqueada:                  "desenvolvedor",
  fila_producao:              "desenvolvedor",
  hom_ag_homologacao:         "arquiteto",
  hom_homologada:             "arquiteto",
};

const PAGE_SIZE = 12;
type ViewMode = "cards" | "table";

export function DemandasList() {
  const { demandas, loading, loadingMore, hasMore, loadMore, error } = useDemandasPaginadas();
  const { create, update, moveTo, remove } = useDemandaMutations();
  const { currentTeamId } = useAuth();
  const { responsaveisMap } = useResponsaveis(currentTeamId, demandas);

  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<Demanda | null>(null);
  const [selected, setSelected]         = useState<Demanda | null>(null);
  const [selectedTab, setSelectedTab]   = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Demanda | null>(null);
  const [search, setSearch]             = useState("");
  const [filterTipo, setFilterTipo]     = useState("all");
  const [filterSituacao, setFilterSituacao] = useState("all");
  const [viewMode, setViewMode]         = useState<ViewMode>("cards");
  const [page, setPage]                 = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // Sentinela — dispara loadMore quando o usuário chega no fim do dataset remoto
  const sentinelaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelaRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 },
    );
    obs.observe(sentinelaRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  // Reset página ao mudar filtros
  useEffect(() => { setPage(1); }, [debouncedSearch, filterTipo, filterSituacao]);

  function getResponsavel(d: Demanda): string | null {
    const papelEsperado = SITUACAO_PAPEL_MAP[d.situacao];
    const lista = responsaveisMap.get(d.id) ?? [];
    return lista.find((r) => r.papel === papelEsperado)?.display_name ?? lista[0]?.display_name ?? null;
  }

  const situacoesUnicas = useMemo(() => [...new Set(demandas.map((d) => d.situacao))], [demandas]);
  const tiposUnicos     = useMemo(() => [...new Set(demandas.map((d) => d.tipo))], [demandas]);

  const filtered = useMemo(
    () =>
      demandas.filter((d) => {
        const q = debouncedSearch.toLowerCase();
        if (
          q &&
          !d.rhm.toLowerCase().includes(q) &&
          !d.projeto.toLowerCase().includes(q) &&
          !(d.titulo || d.descricao || "").toLowerCase().includes(q)
        )
          return false;
        if (filterTipo !== "all" && d.tipo !== filterTipo) return false;
        if (filterSituacao !== "all" && d.situacao !== filterSituacao) return false;
        return true;
      }),
    [demandas, debouncedSearch, filterTipo, filterSituacao],
  );

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Gera números de página visíveis (janela de 5 ao redor da atual)
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) range.push(i);
    return range;
  }, [currentPage, totalPages]);

  function openDemanda(d: Demanda, tab?: string) {
    setSelectedTab(tab);
    setSelected(d);
  }

  async function handleEditSubmit(data: Record<string, any>) {
    if (!editTarget) return;
    try {
      await update(editTarget.id, data);
      toast.success("Demanda atualizada com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao atualizar demanda: " + (e?.message ?? ""));
    }
  }

  function handleDelete(d: Demanda) {
    if (isDemandaIniciada(d)) {
      toast.error("Demanda já iniciada. Use 'Cancelar Demanda' na tela de detalhes.");
    } else {
      setDeleteTarget(d);
    }
  }

  if (selected) {
    const current = demandas.find((d) => d.id === selected.id) || selected;
    return (
      <DemandaDetail
        demanda={current}
        onBack={() => { setSelected(null); setSelectedTab(undefined); }}
        onUpdate={async (id, updates) => { await update(id, updates); }}
        onMoveTo={moveTo}
        initialTab={selectedTab}
      />
    );
  }

  if (loading) return <SkeletonList count={5} />;
  if (error)
    return <div className="text-center py-10 text-destructive">{error}</div>;

  const sharedViewProps = {
    items: paginated,
    getResponsavel,
    onSelect:        (d: Demanda) => openDemanda(d),
    onDelete:        handleDelete,
    onEdit:          (d: Demanda) => setEditTarget(d),
    onNovaAtividade: (d: Demanda) => openDemanda(d, "horas"),
  };

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: "#0bbcaf" }} />
            <h1 className="text-lg font-bold">Demandas</h1>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(11,188,175,0.12)", color: "#0bbcaf" }}
            >
              {filtered.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            {filtered.length} demanda{filtered.length !== 1 ? "s" : ""} carregada{filtered.length !== 1 ? "s" : ""}
            {hasMore && " (mais disponíveis)"}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 text-white"
          style={{ background: "#0bbcaf" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0bbcaf")}
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" /> Nova Demanda
        </Button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por RHM, projeto ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg focus-visible:ring-1"
            style={{ "--tw-ring-color": "#0bbcaf" } as any}
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-9 w-[180px] rounded-lg">
            <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tiposUnicos.map((t) => (
              <SelectItem key={t} value={t}>{getTipoLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="h-9 w-[170px] rounded-lg">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {situacoesUnicas.map((s) => (
              <SelectItem key={s} value={s}>{SITUACAO_LABELS[s] || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle cards / tabela */}
        <div className="flex items-center border rounded-lg overflow-hidden h-9">
          <button
            onClick={() => setViewMode("cards")}
            className={cn(
              "px-2.5 h-full flex items-center transition-colors",
              viewMode === "cards"
                ? "text-[#0bbcaf]"
                : "text-muted-foreground hover:bg-muted",
            )}
            style={viewMode === "cards" ? { background: "rgba(11,188,175,0.12)" } : {}}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-2.5 h-full flex items-center transition-colors",
              viewMode === "table"
                ? "text-[#0bbcaf]"
                : "text-muted-foreground hover:bg-muted",
            )}
            style={viewMode === "table" ? { background: "rgba(11,188,175,0.12)" } : {}}
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {filtered.length === 0 && !loading ? (
        <EmptyState icon={ListTodo} title="Nenhuma demanda encontrada" />
      ) : (
        <>
          {viewMode === "cards" ? (
            <CardView {...sharedViewProps} />
          ) : (
            <TableView {...sharedViewProps} />
          )}

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {filtered.length} demanda{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {pageNumbers[0] > 1 && (
                  <>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(1)}>1</Button>
                    {pageNumbers[0] > 2 && <span className="px-1 text-muted-foreground text-xs">…</span>}
                  </>
                )}

                {pageNumbers.map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    style={n === currentPage ? { background: "#0bbcaf", borderColor: "#0bbcaf" } : {}}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                      <span className="px-1 text-muted-foreground text-xs">…</span>
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(totalPages)}>{totalPages}</Button>
                  </>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Sentinela de scroll infinito (carrega mais do servidor quando chega ao fim) */}
          <div ref={sentinelaRef} className="py-1 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando mais demandas…
              </div>
            )}
            {!loadingMore && !hasMore && demandas.length > 0 && (
              <p className="text-xs text-muted-foreground">Todas as demandas carregadas</p>
            )}
          </div>
        </>
      )}

      <DemandaForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={async (d) => {
          await create(d as any);
          setShowForm(false);
        }}
      />

      <DemandaForm
        open={!!editTarget}
        demanda={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { remove(deleteTarget.id); setDeleteTarget(null); } }}
      />
    </div>
  );
}

// ─── CardView ──────────────────────────────────────────────────────────────────
function CardView({
  items, getResponsavel, onSelect, onDelete, onEdit, onNovaAtividade,
}: {
  items: Demanda[];
  getResponsavel: (d: Demanda) => string | null;
  onSelect: (d: Demanda) => void;
  onDelete: (d: Demanda) => void;
  onEdit: (d: Demanda) => void;
  onNovaAtividade?: (d: Demanda) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((d) => {
        const titulo      = d.titulo || d.descricao;
        const responsavel = getResponsavel(d);
        return (
          <div
            key={d.id}
            onClick={() => onSelect(d)}
            className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200"
            style={{ borderColor: "hsl(var(--border))" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(11,188,175,0.4)";
              e.currentTarget.style.boxShadow   = "0 4px 16px rgba(11,188,175,0.08)";
              e.currentTarget.style.transform   = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "hsl(var(--border))";
              e.currentTarget.style.boxShadow   = "none";
              e.currentTarget.style.transform   = "none";
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Accent bar teal */}
                <span
                  className="h-[18px] w-[3px] rounded-full shrink-0"
                  style={{ background: "#0bbcaf" }}
                />
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: "#0bbcaf" }}
                >
                  {d.rhm}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(d); }}>Detalhes</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(d); }}>Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNovaAtividade?.(d); }}>Nova atividade</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(d); }}>Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 min-w-0">
              {titulo ? (
                <>
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{titulo}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.projeto}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground truncate">{d.projeto}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <Badge variant="outline" className="text-[10px] shrink-0">{getTipoLabel(d.tipo)}</Badge>
                <Badge className={cn("text-[10px] shrink-0", SITUACAO_COLORS[d.situacao] || "")}>
                  {SITUACAO_LABELS[d.situacao] || d.situacao}
                </Badge>
              </div>
              {responsavel && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(11,188,175,0.15)", color: "#0bbcaf" }}
                  >
                    <User className="h-3 w-3" />
                  </div>
                  <span className="truncate max-w-[80px]">{responsavel}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TableView ────────────────────────────────────────────────────────────────
function TableView({
  items, getResponsavel, onSelect, onDelete, onEdit, onNovaAtividade,
}: {
  items: Demanda[];
  getResponsavel: (d: Demanda) => string | null;
  onSelect: (d: Demanda) => void;
  onDelete: (d: Demanda) => void;
  onEdit: (d: Demanda) => void;
  onNovaAtividade?: (d: Demanda) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-28 text-[11px] uppercase tracking-wider">#</TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-wider">Projeto</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Título</TableHead>
            <TableHead className="w-44 text-[11px] uppercase tracking-wider">Tipo</TableHead>
            <TableHead className="w-44 text-[11px] uppercase tracking-wider">Situação</TableHead>
            <TableHead className="w-36 text-[11px] uppercase tracking-wider">Responsável</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => {
            const titulo      = d.titulo || d.descricao;
            const responsavel = getResponsavel(d);
            return (
              <TableRow
                key={d.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(d)}
              >
                <TableCell>
                  <span className="font-mono font-bold text-sm" style={{ color: "#0bbcaf" }}>
                    {d.rhm}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm truncate max-w-[140px] block">{d.projeto}</span>
                </TableCell>
                <TableCell>
                  {titulo
                    ? <span className="text-sm font-medium truncate max-w-[260px] block">{titulo}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{getTipoLabel(d.tipo)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-[10px]", SITUACAO_COLORS[d.situacao] || "")}>
                    {SITUACAO_LABELS[d.situacao] || d.situacao}
                  </Badge>
                </TableCell>
                <TableCell>
                  {responsavel
                    ? <span className="text-xs">{responsavel}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(d); }}>Detalhes</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(d); }}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNovaAtividade?.(d); }}>Nova atividade</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(d); }}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
