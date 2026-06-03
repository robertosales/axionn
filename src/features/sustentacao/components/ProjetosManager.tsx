import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useProjetos } from "../hooks/useProjetos";
import { useDemandas } from "../hooks/useDemandas";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveContracts } from "@/features/contracts/hooks/useContracts";
import type { Projeto } from "../services/projetos.service";
import { ensureDefaultSLAs, type SLA } from "../services/slas.service";
import {
  Plus, Search, FolderKanban, MoreHorizontal,
  FileText, Link2, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type FormState = {
  nome: string;
  descricao: string;
  sla: string;
  sla_id: string;
  contract_id: string;
};

export function ProjetosManager() {
  const { projetos, loading, error, create, update, remove, reload } = useProjetos();
  const { demandas } = useDemandas();
  const { currentTeamId } = useAuth();
  const { contracts: activeContracts, loading: loadingContracts } = useActiveContracts();

  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Projeto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Projeto | null>(null);
  const [search, setSearch]           = useState('');
  const [filterSla, setFilterSla]     = useState('all');
  const [filterContract, setFilterContract] = useState('all');
  const debouncedSearch               = useDebounce(search, 300);

  const [slas, setSlas] = useState<SLA[]>([]);
  const emptyForm: FormState = { nome: '', descricao: '', sla: 'padrao', sla_id: '', contract_id: '' };
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!currentTeamId) return;
    ensureDefaultSLAs(currentTeamId).then(setSlas).catch(() => {});
  }, [currentTeamId]);

  const slaMap = useMemo(() => {
    const m: Record<string, SLA> = {};
    slas.forEach(s => { m[s.id] = s; m[s.regime_base] = s; });
    return m;
  }, [slas]);

  const contractMap = useMemo(() => {
    const m: Record<string, string> = {};
    activeContracts.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [activeContracts]);

  const filtered = useMemo(() => {
    return projetos.filter(p => {
      if (debouncedSearch && !p.nome.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (filterSla !== 'all') {
        const projetoSla = p.sla_id ? slaMap[p.sla_id]?.regime_base : p.sla;
        if (projetoSla !== filterSla) return false;
      }
      if (filterContract !== 'all') {
        const pid = (p as any).contract_id ?? null;
        if (filterContract === '_none') {
          if (pid) return false;
        } else {
          if (pid !== filterContract) return false;
        }
      }
      return true;
    });
  }, [projetos, debouncedSearch, filterSla, filterContract, slaMap]);

  const { paginatedItems, currentPage, setCurrentPage, totalPages, totalItems } =
    usePagination(filtered, { pageSize: 20 });

  const demandasPorProjeto = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach(d => {
      const key = d.projeto || '';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [demandas]);

  const getSlaLabel = (p: Projeto) => {
    if (p.sla_id && slaMap[p.sla_id]) return slaMap[p.sla_id].nome;
    if (p.sla === 'continuo') return 'Contínuo';
    return 'Padrão';
  };

  const getSlaRegime = (p: Projeto) => {
    if (p.sla_id && slaMap[p.sla_id]) return slaMap[p.sla_id].regime_base;
    return p.sla;
  };

  const openCreate = () => {
    const defaultSla = slas.find(s => s.regime_base === 'padrao');
    setForm({ ...emptyForm, sla: 'padrao', sla_id: defaultSla?.id || '' });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: Projeto) => {
    setForm({
      nome:        p.nome,
      descricao:   p.descricao || '',
      sla:         p.sla,
      sla_id:      p.sla_id || '',
      contract_id: (p as any).contract_id || '',
    });
    setEditing(p);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) { toast.error('Preencha o nome do projeto'); return; }
    const selectedSla = slas.find(s => s.id === form.sla_id);
    const payload: any = {
      nome:        form.nome,
      descricao:   form.descricao,
      sla:         selectedSla?.regime_base || form.sla,
      sla_id:      form.sla_id  || null,
      contract_id: form.contract_id || null,
    };
    if (editing) {
      await update(editing.id, payload);
    } else {
      await create(payload);
    }
    setShowForm(false);
  };

  if (loading) return <SkeletonList count={4} />;
  if (error) return (
    <div className="text-center py-10 text-destructive">
      {error} <button onClick={reload} className="underline ml-2">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projetos</h2>
          <p className="text-sm text-muted-foreground">Gerencie os projetos e seus vínculos com contratos</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />Novo Projeto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar projeto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterContract} onValueChange={setFilterContract}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Todos os contratos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            <SelectItem value="_none">Sem contrato</SelectItem>
            {activeContracts.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSla} onValueChange={setFilterSla}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Todos os SLAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os SLAs</SelectItem>
            {slas.map(s => (
              <SelectItem key={s.id} value={s.regime_base}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de projetos */}
      {filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto encontrado" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map(p => {
              const regime      = getSlaRegime(p);
              const contractId  = (p as any).contract_id as string | null;
              const contractName = contractId ? contractMap[contractId] : null;

              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{p.nome}</h3>
                          {regime === 'continuo' ? (
                            <Badge variant="destructive" className="text-[10px] shrink-0">SLA Contínuo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              <ShieldCheck className="h-2.5 w-2.5 mr-1" />{getSlaLabel(p)}
                            </Badge>
                          )}
                        </div>
                        {p.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(p)}>
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {contractName && (
                        <div className="flex items-center gap-1 text-primary">
                          <Link2 className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{contractName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {demandasPorProjeto[p.nome] || 0} demandas
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={20}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Dialog de criar/editar */}
      <Dialog open={showForm} onOpenChange={o => !o && setShowForm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize as informações do projeto.'
                : 'Preencha os dados para criar um novo projeto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do projeto"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Vínculo com Contrato — Fase 2 */}
            <div>
              <Label>Contrato</Label>
              <Select
                value={form.contract_id || '_none'}
                onValueChange={v => setForm(p => ({ ...p, contract_id: v === '_none' ? '' : v }))}
                disabled={loadingContracts}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um contrato (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem contrato</SelectItem>
                  {activeContracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Vincule a um contrato de fábrica para herdar as regras comerciais e SLA.
              </p>
            </div>

            <div>
              <Label>SLA de atendimento</Label>
              <Select
                value={form.sla_id || '_legacy'}
                onValueChange={v => {
                  if (v === '_legacy') return;
                  const sla = slas.find(s => s.id === v);
                  setForm(p => ({ ...p, sla_id: v, sla: sla?.regime_base || 'padrao' }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o SLA" /></SelectTrigger>
                <SelectContent>
                  {slas.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} ({s.regime_base === 'continuo' ? '24×7' : '8h–20h seg–sex'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Define o regime de horas para cálculo de SLA das demandas deste projeto.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Projeto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const count = demandasPorProjeto[deleteTarget.nome] || 0;
          if (count > 0) {
            toast.error(`Não é possível excluir: existem ${count} demanda(s) vinculada(s).`);
            setDeleteTarget(null);
            return;
          }
          remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
