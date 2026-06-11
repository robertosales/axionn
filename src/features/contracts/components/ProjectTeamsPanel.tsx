/**
 * ProjectTeamsPanel — Tela de Gestão do Contrato: aba Projetos & Times.
 *
 * Arquitetura:
 *   - Lê vínculos de contract_room_teams (contrato + time + projeto + sala)
 *   - Botão "+ Vincular Time / Projeto" abre modal com seleção em cascata:
 *       1. Dropdown: todos os times globais (dedup por id)
 *       2. Dropdown: projetos do time selecionado (habilitado após step 1)
 *   - Desvincular remove a linha de contract_room_teams
 *   - Projetos são agrupados por Time Pai na renderização
 *
 * fix(bind-modal-dedup): AuthContext armazena uma entrada por (time × módulo)
 *   intencionalmente (para t.module filtros internos do board). O dropdown de
 *   times no BindModal precisa deduplicar por id antes de renderizar para
 *   evitar que o mesmo time apareça duas vezes quando ele pertence a mais
 *   de um módulo (ex: sustentacao + sala_agil).
 */
import { useState, useEffect } from 'react';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  FolderKanban, Plus, Trash2, Loader2,
  Info, Zap, Wrench, Users, Link2, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchBindingsByContract,
  fetchProjectsByTeam,
  createBinding,
  removeBinding,
  createProject,
  type ContractRoomBinding,
  type Project,
  type ProjectInput,
} from '../services/projects.service';
import { ProjectForm } from './ProjectForm';
import type { RoomMode } from '../types/contract';

const MODULE_BADGE: Record<string, string> = {
  sustenance: 'bg-purple-950 text-purple-300 border-purple-800',
  agile:      'bg-blue-950   text-blue-300   border-blue-800',
  mixed:      'bg-orange-950 text-orange-300 border-orange-800',
};
const MODULE_LABEL: Record<string, string> = {
  sustenance: '🛠 Sustentação',
  agile:      '⚡ Ágil',
  mixed:      '🔀 Misto',
};

interface Props {
  contractId: string;
  roomMode?: RoomMode;
}

// ── Modal de vínculo (seleção em cascata Time → Projeto) ──────────────────────
interface BindModalProps {
  contractId: string;
  roomType:   'agil' | 'sustentacao';
  existingBindings: ContractRoomBinding[];
  onClose:    () => void;
  onSuccess:  () => void;
}

function BindModal({ contractId, roomType, existingBindings, onClose, onSuccess }: BindModalProps) {
  const { teams } = useAuth();
  const [teamId,    setTeamId]    = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saving, setSaving] = useState(false);

  // fix(bind-modal-dedup): AuthContext armazena (id × módulo), então um time
  // que pertence a sustentacao + sala_agil aparece duas vezes em `teams`.
  // Deduplicamos por id antes de renderizar o dropdown.
  const uniqueTeams = (teams as any[]).filter(
    (t, idx, arr) => arr.findIndex((x: any) => x.id === t.id) === idx
  );

  // Quando muda o time, carrega projetos dele
  useEffect(() => {
    if (!teamId) { setProjects([]); setProjectId(''); return; }
    setLoadingProjects(true);
    fetchProjectsByTeam(teamId)
      .then(setProjects)
      .catch(() => toast.error('Erro ao carregar projetos do time'))
      .finally(() => setLoadingProjects(false));
    setProjectId('');
  }, [teamId]);

  // Times já vinculados nesta sala (para desabilitar no dropdown)
  const boundTeamProjectPairs = new Set(
    existingBindings
      .filter(b => b.room_type === roomType)
      .map(b => `${b.team_id}::${b.project_id ?? 'null'}`)
  );

  async function handleSave() {
    if (!teamId) { toast.error('Selecione um time'); return; }
    const pairKey = `${teamId}::${projectId || 'null'}`;
    if (boundTeamProjectPairs.has(pairKey)) {
      toast.error('Este vínculo já existe nesta sala'); return;
    }
    setSaving(true);
    try {
      await createBinding(contractId, teamId, roomType, projectId || null);
      toast.success('Vínculo criado com sucesso!');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao criar vínculo');
    } finally {
      setSaving(false);
    }
  }

  const roomLabel = roomType === 'sustentacao' ? 'Sustentação' : 'Ágil';
  const roomIcon  = roomType === 'sustentacao'
    ? <Wrench className="h-3.5 w-3.5 text-purple-400" />
    : <Zap    className="h-3.5 w-3.5 text-blue-400"   />;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                      w-full max-w-md bg-background border rounded-xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Vincular Time / Projeto</h3>
            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
              {roomIcon} {roomLabel}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Step 1 — Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground
                               text-[10px] flex items-center justify-center font-bold">1</span>
              Selecione o Time <span className="text-destructive">*</span>
            </label>
            <Select value={teamId || '_none'} onValueChange={v => setTeamId(v === '_none' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar time..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none" disabled>Selecionar time...</SelectItem>
                {uniqueTeams.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2 — Projeto (habilitado após selecionar time) */}
          <div className="space-y-1.5">
            <label className={`text-xs font-medium flex items-center gap-1.5 ${
              !teamId ? 'opacity-40' : ''
            }`}>
              <span className="w-4 h-4 rounded-full bg-muted text-muted-foreground
                               text-[10px] flex items-center justify-center font-bold">2</span>
              Selecione o Projeto
              <span className="text-[10px] text-muted-foreground">(opcional)</span>
            </label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando projetos...
              </div>
            ) : (
              <Select
                value={projectId || '_none'}
                onValueChange={v => setProjectId(v === '_none' ? '' : v)}
                disabled={!teamId}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={!teamId ? 'Selecione um time primeiro' : 'Selecionar projeto...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">
                    {projects.length === 0 && teamId
                      ? 'Nenhum projeto neste time'
                      : 'Vincular apenas o time (sem projeto)'}
                  </SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{p.name}</span>
                        {p.code && <span className="text-[10px] text-muted-foreground font-mono">({p.code})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dica */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 border px-3 py-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Você pode vincular apenas um time agora e adicionar os projetos depois,
              clicando novamente em <strong>+ Vincular</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/20 rounded-b-xl">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!teamId || saving} onClick={handleSave} className="min-w-[90px]">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar Vínculo'}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────
export function ProjectTeamsPanel({ contractId, roomMode = 'hibrido' }: Props) {
  const [bindings,   setBindings]   = useState<ContractRoomBinding[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<'sustentacao' | 'agil'>('sustentacao');
  const [showBind,   setShowBind]   = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const showSustentacao = roomMode === 'sustentacao' || roomMode === 'hibrido';
  const showAgil        = roomMode === 'agil'        || roomMode === 'hibrido';

  async function load() {
    setLoading(true);
    try { setBindings(await fetchBindingsByContract(contractId)); }
    catch (e: any) { toast.error(e?.message ?? 'Erro ao carregar vínculos'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [contractId]);

  async function handleRemove(bindingId: string) {
    if (!confirm('Remover este vínculo do contrato?')) return;
    try {
      await removeBinding(bindingId);
      toast.success('Vínculo removido.');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao remover');
    }
  }

  // Agrupa vínculos por sala e depois por time (para renderização)
  function bindingsForRoom(room: 'agil' | 'sustentacao') {
    const roomBindings = bindings.filter(b => b.room_type === room);
    const grouped = new Map<string, { teamName: string; items: ContractRoomBinding[] }>();
    for (const b of roomBindings) {
      if (!grouped.has(b.team_id)) {
        grouped.set(b.team_id, { teamName: b.team_name ?? b.team_id, items: [] });
      }
      grouped.get(b.team_id)!.items.push(b);
    }
    return grouped;
  }

  const renderRoom = (room: 'agil' | 'sustentacao') => {
    const grouped  = bindingsForRoom(room);
    const isEmpty  = grouped.size === 0;
    const isSust   = room === 'sustentacao';
    const infoClass = isSust
      ? 'bg-purple-950/30 border-purple-800/40 text-purple-300'
      : 'bg-blue-950/30   border-blue-800/40   text-blue-300';
    const infoIcon  = isSust
      ? <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
      : <Zap    className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400"   />;
    const infoText  = isSust
      ? 'Times de sustentação têm SLA contratual. O compliance é monitorado no painel.'
      : 'Times ágeis não possuem SLA contratual neste módulo.';

    return (
      <div className="space-y-3">
        {/* Banner informativo */}
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${infoClass}`}>
          {infoIcon}
          <p className="text-[11px]">{infoText}</p>
        </div>

        {/* Botão vincular */}
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
            onClick={() => setShowBind(true)}>
            <Plus className="h-3 w-3" /> Vincular Time / Projeto
          </Button>
        </div>

        {/* Lista de vínculos agrupados por time */}
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : isEmpty ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
            <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum projeto ativo nesta sala.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Clique em <strong>+ Vincular Time / Projeto</strong> para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([teamId, { teamName, items }]) => (
              <div key={teamId} className="rounded-lg border bg-card overflow-hidden">
                {/* Time header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{teamName}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {items.length} {items.length === 1 ? 'projeto' : 'projetos'}
                  </Badge>
                </div>

                {/* Projetos do time */}
                <div className="divide-y">
                  {items.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-4 py-2.5
                                               hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {b.project_name ? (
                          <>
                            <span className="text-sm truncate">{b.project_name}</span>
                            {b.project_code && (
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                ({b.project_code})
                              </span>
                            )}
                            {b.project_module_type && (
                              <Badge variant="outline"
                                className={`text-[10px] shrink-0 ${
                                  MODULE_BADGE[b.project_module_type] ?? ''
                                }`}>
                                {MODULE_LABEL[b.project_module_type] ?? b.project_module_type}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Sem projeto</span>
                        )}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleRemove(b.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remover vínculo</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Abas dinâmicas conforme room_mode */}
      {showSustentacao && showAgil ? (
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="sustentacao" className="flex-1 gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Sustentação
            </TabsTrigger>
            <TabsTrigger value="agil" className="flex-1 gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Ágil
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sustentacao" className="mt-3">{renderRoom('sustentacao')}</TabsContent>
          <TabsContent value="agil"        className="mt-3">{renderRoom('agil')}</TabsContent>
        </Tabs>
      ) : showSustentacao ? (
        renderRoom('sustentacao')
      ) : (
        renderRoom('agil')
      )}

      {/* Modal: Vincular Time / Projeto */}
      {showBind && (
        <BindModal
          contractId={contractId}
          roomType={activeTab}
          existingBindings={bindings}
          onClose={() => setShowBind(false)}
          onSuccess={load}
        />
      )}

      {/* Modal: Novo Projeto (catálogo global) */}
      {showForm && (
        <ProjectForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); }}
          onSubmit={async (input: ProjectInput) => { await createProject(input); }}
        />
      )}
    </div>
  );
}
