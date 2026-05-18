import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Plus, Search, ListTodo, LayoutGrid, LayoutList, User, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useDemandas } from "../hooks/useDemandas";
import { toast } from "sonner";
import { DemandaForm } from "./DemandaForm";
import { DemandaDetail } from "./DemandaDetail";
import { SITUACAO_LABELS, SITUACAO_COLORS, isDemandaIniciada } from "../types/demanda";
import type { Demanda } from "../types/demanda";
import { fetchResponsaveisWithPapelByDemandaIds } from "../services/profiles.service";
import { cn } from "@/lib/utils";

const SITUACAO_PAPEL_MAP: Record<string, string> = {
  fila_atendimento: "analista",
  planejamento_elaboracao: "analista",
  planejamento_ag_aprovacao: "analista",
  planejamento_aprovada: "analista",
  em_execucao: "desenvolvedor",
  bloqueada: "desenvolvedor",
  fila_producao: "desenvolvedor",
  hom_ag_homologacao: "arquiteto",
  hom_homologada: "arquiteto",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const fetchResponsaveisBatch = fetchResponsaveisWithPapelByDemandaIds;

type ViewMode = "cards" | "table";

export function DemandasList() {
  const { demandas, loading, error, create, update, moveTo, remove, reload } = useDemandas();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Demanda | null>(null);
  const [selected, setSelected] = useState<Demanda | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Demanda | null>(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterSituacao, setFilterSituacao] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebounce(search, 300);

  const [responsaveisMap, setResponsaveisMap] = useState<Map<string, { papel: string; display_name: string }[]>>(
    new Map(),
  );

  useEffect(() => {
    if (!demandas.length) return;
    fetchResponsaveisBatch(demandas.map((d) => d.id)).then(setResponsaveisMap);
  }, [demandas]);

  function getResponsavel(d: Demanda): string | null {
    const papelEsperado = SITUACAO_PAPEL_MAP[d.situacao];
    const lista = responsaveisMap.get(d.id) || [];
    return lista.find((r) => r.papel === papelEsperado)?.display_name || lista[0]?.display_name || null;
  }

  const situacoesUnicas = useMemo(() => [...new Set(demandas.map((d) => d.situacao))], [demandas]);

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

  const { paginatedItems, currentPage, setCurrentPage, totalItems } = usePagination(filtered, { pageSize });

  function openDemanda(d: Demanda, tab?: string) {
    setSelectedTab(tab);
    setSelected(d);
  }

  function handleEdit(d: Demanda) {
    setEditTarget(d);
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

  // ── Detail view ──────────────────────────────────────────────────────────────
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
    return (
      <div className="text-center py-10 text-destructive">
        {error}{" "}
        <button onClick={reload} className="underline ml-2">Tentar novamente</button>
      </div>
    );

  function handleDelete(d: Demanda) {
    if (isDemandaIniciada(d)) {
      toast.error("Demanda já iniciada. Use 'Cancelar Demanda' na tela de detalhes.");
    } else {
      setDeleteTarget(d);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Demandas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalItems} demanda{totalItems !== 1 ? "s" : ""} encontrada{totalItems !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Nova Demanda
        </Button>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por RHM, projeto ou título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-9 w-[150px]">
            <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {["corretiva", "evolutiva", "melhoria"].map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {situacoesUnicas.map((s) => (
              <SelectItem key={s} value={s}>{SITUACAO_LABELS[s] || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md overflow-hidden h-9">
          <button onClick={() => setViewMode("cards")} className={cn("px-2.5 h-full flex items-center transition-colors", viewMode === "cards" ? "bg-amber-500/15 text-amber-600" : "text-muted-foreground hover:bg-muted")}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("table")} className={cn("px-2.5 h-full flex items-center transition-colors", viewMode === "table" ? "bg-amber-500/15 text-amber-600" : "text-muted-foreground hover:bg-muted")}>
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nenhuma demanda encontrada" />
      ) : (
        <>
          {viewMode === "cards" ? (
            <CardView items={paginatedItems} getResponsavel={getResponsavel} onSelect={(d) => openDemanda(d)} onDelete={handleDelete} onEdit={handleEdit} onNovaAtividade={(d) => openDemanda(d, "horas")} />
          ) : (
            <TableView items={paginatedItems} getResponsavel={getResponsavel} onSelect={(d) => openDemanda(d)} onDelete={handleDelete} onEdit={handleEdit} onNovaAtividade={(d) => openDemanda(d, "horas")} />
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Itens por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZE_OPTIONS.map((opt) => (<SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* Form criação */}
      <DemandaForm open={showForm} onClose={() => setShowForm(false)} onSubmit={(d) => create(d as any)} />

      {/* Form edição */}
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

// ─── CardView ─────────────────────────────────────────────────────────────────
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
        const titulo = d.titulo || d.descricao;
        const responsavel = getResponsavel(d);
        return (
          <div key={d.id} onClick={() => onSelect(d)}
            className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:border-amber-400/50 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-amber-400 shrink-0" />
                <span className="font-mono text-sm font-bold text-amber-500">{d.rhm}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">{d.tipo}</Badge>
                <Badge className={cn("text-[10px] shrink-0", SITUACAO_COLORS[d.situacao] || "")}>{SITUACAO_LABELS[d.situacao] || d.situacao}</Badge>
              </div>
              {responsavel && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <div className="h-5 w-5 rounded-full bg-amber-400/20 text-amber-600 flex items-center justify-center shrink-0"><User className="h-3 w-3" /></div>
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
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-28">#</TableHead>
            <TableHead className="w-40">Projeto</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-28">Tipo</TableHead>
            <TableHead className="w-44">Situação</TableHead>
            <TableHead className="w-36">Responsável</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => {
            const titulo = d.titulo || d.descricao;
            const responsavel = getResponsavel(d);
            return (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(d)}>
                <TableCell><span className="font-mono font-bold text-amber-500 text-sm">{d.rhm}</span></TableCell>
                <TableCell><span className="text-sm truncate max-w-[140px] block">{d.projeto}</span></TableCell>
                <TableCell>
                  {titulo ? <span className="text-sm font-medium truncate max-w-[260px] block">{titulo}</span> : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-[10px]">{d.tipo}</Badge></TableCell>
                <TableCell><Badge className={cn("text-[10px]", SITUACAO_COLORS[d.situacao] || "")}>{SITUACAO_LABELS[d.situacao] || d.situacao}</Badge></TableCell>
                <TableCell>{responsavel ? <span className="text-xs">{responsavel}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
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
