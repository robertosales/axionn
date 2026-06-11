/**
 * ProjetosManager — Catálogo global de projetos.
 *
 * ARQUITETURA (Fase 2):
 *   - Projeto é um item global, sem vínculo direto a contrato.
 *   - O vínculo contrato ↔ time ↔ projeto é feito na Tela de Gestão
 *     do Contrato via ProjectTeamsPanel (contract_room_teams).
 *   - SLA herdado do contrato via vínculo — não é definido aqui.
 */
import { useState, useMemo } from 'react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Label }     from '@/components/ui/label';
import { Badge }     from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog }    from '@/shared/components/common/ConfirmDialog';
import { EmptyState }       from '@/shared/components/common/EmptyState';
import { SkeletonList }     from '@/shared/components/common/SkeletonList';
import { PaginationControls } from '@/shared/components/common/Pagination';
import { usePagination }    from '@/shared/hooks/usePagination';
import { useDebounce }      from '@/shared/hooks/useDebounce';
import { useProjetos }      from '../hooks/useProjetos';
import { useDemandas }      from '../hooks/useDemandas';
import type { Projeto }     from '../services/projetos.service';
import {
  Plus, Search, FolderKanban, MoreHorizontal,
  FileText, Layers,
} from 'lucide-react';
import { toast } from 'sonner';

const MODULE_OPTIONS = [
  { value: 'sustenance', label: '🛠 Sustentação' },
  { value: 'agile',      label: '⚡ Ágil'         },
  { value: 'mixed',      label: '🔀 Misto'        },
];
const MODULE_BADGE: Record<string, string> = {
  sustenance: 'bg-purple-950 text-purple-300 border-purple-800',
  agile:      'bg-blue-950   text-blue-300   border-blue-800',
  mixed:      'bg-orange-950 text-orange-300 border-orange-800',
};

type FormState = {
  nome:        string;
  descricao:   string;
  module_type: string;
  code:        string;
  redmine_id:  string;
};

const EMPTY_FORM: FormState = {
  nome: '', descricao: '', module_type: 'sustenance', code: '', redmine_id: '',
};

export function ProjetosManager() {
  const { projetos, loading, error, create, update, remove, reload } = useProjetos();
  const { demandas } = useDemandas();

  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState<Projeto | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Projeto | null>(null);
  const [search,        setSearch]        = useState('');
  const [filterModule,  setFilterModule]  = useState('all');
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM);
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => projetos.filter(p => {
    if (debouncedSearch && !p.nome.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (filterModule !== 'all' && (p as any).module_type !== filterModule) return false;
    return true;
  }), [projetos, debouncedSearch, filterModule]);

  const { paginatedItems, currentPage, setCurrentPage, totalPages, totalItems } =
    usePagination(filtered, { pageSize: 20 });

  const demandasPorProjeto = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach(d => { const k = d.projeto || ''; map[k] = (map[k] || 0) + 1; });
    return map;
  }, [demandas]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); };
  const openEdit   = (p: Projeto) => {
    setForm({
      nome:        p.nome,
      descricao:   p.descricao || '',
      module_type: (p as any).module_type || 'sustenance',
      code:        (p as any).code || '',
      redmine_id:  (p as any).redmine_id?.toString() || '',
    });
    setEditing(p);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) { toast.error('Preencha o nome do projeto'); return; }
    const payload: any = {
      nome:        form.nome,
      descricao:   form.descricao || null,
      module_type: form.module_type,
      code:        form.code || null,
      redmine_id:  form.redmine_id ? Number(form.redmine_id) : null,
    };
    if (editing) { await update(editing.id, payload); }
    else         { await create(payload); }
    setShowForm(false);
  };

  if (loading) return <SkeletonList count={4} />;
  if (error)   return (
    <div className="text-center py-10 text-destructive">
      {error} <button onClick={reload} className="underline ml-2">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Cabeçalho — padrão igual ContractDetail */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold">Projetos</h2>
            <p className="text-xs text-muted-foreground">
              Catálogo global — vínculos com contratos são feitos na tela de gestão do contrato
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Projeto
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
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Tipo de módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {MODULE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto encontrado" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map(p => {
              const modType     = (p as any).module_type as string | null;
              const modBadge    = modType ? MODULE_BADGE[modType] : undefined;
              const modLabel    = MODULE_OPTIONS.find(o => o.value === modType)?.label ?? modType;
              const demCount    = demandasPorProjeto[p.nome] || 0;
              const code        = (p as any).code as string | null;

              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">

                    {/* Header do card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{p.nome}</h3>
                          {code && (
                            <span className="text-[10px] text-muted-foreground font-mono">({code})</span>
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
                          <DropdownMenuItem className="text-destructive"
                            onClick={() => setDeleteTarget(p)}>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Footer do card */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {modBadge && modLabel && (
                        <Badge variant="outline" className={`text-[10px] border ${modBadge}`}>
                          <Layers className="h-2.5 w-2.5 mr-1" />{modLabel}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <FileText className="h-3 w-3" />
                        {demCount} demanda{demCount !== 1 ? 's' : ''}
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

      {/* Dialog criar / editar — layout padronizado */}
      <Dialog open={showForm} onOpenChange={o => !o && setShowForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              {editing ? 'Editar Projeto' : 'Novo Projeto'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize as informações do projeto.'
                : 'Projeto cadastrado no catálogo global. O vínculo com contrato é feito na tela de gestão do contrato.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">

            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: NEXO, GESP3, App Mobile"
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* Código + Redmine */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Código</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="Ex: NEXO"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Redmine ID</Label>
                <Input
                  type="number"
                  value={form.redmine_id}
                  onChange={e => setForm(p => ({ ...p, redmine_id: e.target.value }))}
                  placeholder="ID numérico"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Tipo de módulo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Módulo</Label>
              <Select
                value={form.module_type}
                onValueChange={v => setForm(p => ({ ...p, module_type: v }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                rows={2}
                className="text-sm resize-none"
                placeholder="Descrição opcional"
              />
            </div>

          </div>

          <DialogFooter className="border-t pt-3 mt-1 bg-muted/10 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} className="min-w-[90px]">
              {editing ? 'Salvar' : 'Criar Projeto'}
            </Button>
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
