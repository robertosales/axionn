import { useState, useMemo } from 'react';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Label }       from '@/components/ui/label';
import { Badge }       from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog }      from '@/shared/components/common/ConfirmDialog';
import { EmptyState }         from '@/shared/components/common/EmptyState';
import { SkeletonList }       from '@/shared/components/common/SkeletonList';
import { PaginationControls } from '@/shared/components/common/Pagination';
import { usePagination }      from '@/shared/hooks/usePagination';
import { useDebounce }        from '@/shared/hooks/useDebounce';
import { useProjetosAdmin }   from '../hooks/useProjetosAdmin';
import { useContractContext } from '../contexts/ContractContext';
import { PageHeader }         from './PageHeader';
import type { ProjetoAdmin }  from '../services/projects.service';
import { Plus, Search, FolderKanban, MoreHorizontal, Layers, Building2, Users, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useContracts }  from '@/features/admin/hooks/useContracts';
import { useTeamsAdmin } from '@/features/admin/hooks/useTeamsAdmin';

const MODULE_OPTIONS = [
  { value: 'sustenance', label: '🔧 Sustentação' },
  { value: 'agile',      label: '⚡ Ágil'         },
  { value: 'mixed',      label: '🔀 Misto'        },
];
const MODULE_BADGE: Record<string, string> = {
  sustenance: 'bg-purple-950 text-purple-300 border-purple-800',
  agile:      'bg-blue-950   text-blue-300   border-blue-800',
  mixed:      'bg-orange-950 text-orange-300 border-orange-800',
};

type FormState = {
  name: string; description: string; contract_id: string;
  team_id: string; module_type: string; code: string; redmine_id: string;
};
const EMPTY_FORM: FormState = {
  name: '', description: '', contract_id: '',
  team_id: '', module_type: 'sustenance', code: '', redmine_id: '',
};

export function ProjetosAdminPanel() {
  const { selectedContractId, selectedContract } = useContractContext();
  const { projetos, loading, error, create, update, archive, reload } = useProjetosAdmin(selectedContractId);
  const { contracts } = useContracts();
  const { teams }     = useTeamsAdmin(selectedContractId);

  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState<ProjetoAdmin | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjetoAdmin | null>(null);
  const [search,        setSearch]        = useState('');
  const [filterModule,  setFilterModule]  = useState('all');
  const [filterTeam,    setFilterTeam]    = useState('all');
  const [form,          setForm]          = useState<FormState>({ ...EMPTY_FORM, contract_id: selectedContractId ?? '' });
  const debouncedSearch = useDebounce(search, 300);

  const hasFilters = debouncedSearch || filterModule !== 'all' || filterTeam !== 'all';
  const clearFilters = () => { setSearch(''); setFilterModule('all'); setFilterTeam('all'); };

  const filtered = useMemo(() => projetos.filter(p => {
    if (debouncedSearch && !p.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (filterModule !== 'all' && p.module_type !== filterModule) return false;
    if (filterTeam  !== 'all' && p.team_id     !== filterTeam)   return false;
    return true;
  }), [projetos, debouncedSearch, filterModule, filterTeam]);

  const { paginatedItems, currentPage, setCurrentPage, totalItems } = usePagination(filtered, { pageSize: 20 });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, contract_id: selectedContractId ?? '' });
    setEditing(null); setShowForm(true);
  };
  const openEdit = (p: ProjetoAdmin) => {
    setForm({ name: p.name, description: p.description || '', contract_id: p.contract_id || '',
      team_id: p.team_id || '', module_type: p.module_type, code: p.code || '', redmine_id: p.redmine_id?.toString() || '' });
    setEditing(p); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Preencha o nome do projeto'); return; }
    if (!form.contract_id) { toast.error('Selecione o contrato');       return; }
    const payload = {
      contract_id: form.contract_id, team_id: form.team_id || null,
      name: form.name.trim(), description: form.description || null,
      code: form.code || null, module_type: form.module_type as ProjetoAdmin['module_type'],
      redmine_id: form.redmine_id ? Number(form.redmine_id) : null,
    };
    try {
      if (editing) { await update(editing.id, payload); toast.success('Projeto atualizado'); }
      else         { await create(payload);              toast.success('Projeto criado');     }
      setShowForm(false);
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao salvar projeto'); }
  };

  if (loading) return <SkeletonList count={4} />;
  if (error)   return (
    <div className="text-center py-10 text-destructive">
      {error} <button onClick={reload} className="underline ml-2">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FolderKanban}
        iconColor="text-orange-400"
        description={`${filtered.length} de ${projetos.length} projeto${projetos.length !== 1 ? 's' : ''}`}
        badges={selectedContract ? [{ label: selectedContract.name, icon: FileText, className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5" }] : []}
        actions={[{ label: 'Novo Projeto', icon: Plus, onClick: openCreate }]}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar projeto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTeam} onValueChange={v => { setFilterTeam(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[170px] h-9">
            <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Todas as salas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as salas</SelectItem>
            {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterModule} onValueChange={v => { setFilterModule(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[155px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {MODULE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto encontrado" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map(p => {
              const modBadge = MODULE_BADGE[p.module_type];
              const modLabel = MODULE_OPTIONS.find(o => o.value === p.module_type)?.label;
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                          {p.code && <span className="text-[10px] text-muted-foreground font-mono">({p.code})</span>}
                          {p.legacy_projetos_id && <Badge variant="outline" className="text-[9px] border-yellow-700 text-yellow-400 bg-yellow-950">migrado</Badge>}
                          {p.status === 'paused' && <Badge variant="outline" className="text-[9px] border-orange-700 text-orange-400 bg-orange-950">pausado</Badge>}
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setArchiveTarget(p)}>Arquivar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1">
                      {p.contract_name && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" /><span className="truncate">{p.contract_name}</span>
                        </div>
                      )}
                      {p.team_name && (
                        <button
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                          onClick={() => { const t = teams.find((x: any) => x.id === p.team_id); if (t) setFilterTeam(t.id); }}
                        >
                          <Users className="h-3 w-3 shrink-0" /><span className="truncate">{p.team_name}</span>
                        </button>
                      )}
                    </div>
                    {modBadge && modLabel && (
                      <Badge variant="outline" className={`text-[10px] border ${modBadge}`}>
                        <Layers className="h-2.5 w-2.5 mr-1" />{modLabel}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={20} onPageChange={setCurrentPage} />
        </>
      )}

      <Dialog open={showForm} onOpenChange={o => !o && setShowForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              {editing ? 'Editar Projeto' : 'Novo Projeto'}
            </DialogTitle>
            <DialogDescription>Vincule o projeto a um contrato e, opcionalmente, a uma sala.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: [SUST] GPOL" className="h-8 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contrato <span className="text-destructive">*</span></Label>
              <Select value={form.contract_id} onValueChange={v => setForm(p => ({ ...p, contract_id: v, team_id: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{(contracts ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sala (opcional)</Label>
              <Select value={form.team_id || 'none'} onValueChange={v => setForm(p => ({ ...p, team_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione a sala..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem sala específica</SelectItem>
                  {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Módulo</Label>
              <Select value={form.module_type} onValueChange={v => setForm(p => ({ ...p, module_type: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{MODULE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Código</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Ex: GPOL" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Redmine ID</Label>
                <Input type="number" value={form.redmine_id} onChange={e => setForm(p => ({ ...p, redmine_id: e.target.value }))} placeholder="ID numérico" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="text-sm resize-none" placeholder="Descrição opcional" />
            </div>
          </div>
          <DialogFooter className="border-t pt-3 mt-1 bg-muted/10 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} className="min-w-[90px]">{editing ? 'Salvar' : 'Criar Projeto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Arquivar projeto?"
        description={`O projeto "${archiveTarget?.name}" será arquivado. Os dados históricos são preservados.`}
        onOpenChange={o => !o && setArchiveTarget(null)}
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archive(archiveTarget.id); toast.success('Projeto arquivado'); setArchiveTarget(null);
        }}
      />
    </div>
  );
}
