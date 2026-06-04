import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import {
  FolderKanban, Plus, Trash2, Loader2,
  Archive, Edit2, Users, Info, Zap, Wrench,
} from 'lucide-react';
import { ProjectForm } from './ProjectForm';
import type { Project, ProjectInput } from '../services/projects.service';
import type { RoomMode } from '../types/contract';

const MODULE_CONFIG = {
  sustenance: { label: '🛠 Sustentação', className: 'bg-purple-950 text-purple-300 border-purple-800' },
  agile:      { label: '⚡ Ágil',        className: 'bg-blue-950   text-blue-300   border-blue-800'   },
  mixed:      { label: '🔀 Misto',       className: 'bg-orange-950 text-orange-300 border-orange-800' },
};

interface Props {
  contractId: string;
  roomMode?: RoomMode;   // Passado pelo ContractDetail para filtrar abas
}

export function ProjectTeamsPanel({ contractId, roomMode = 'hibrido' }: Props) {
  const { projects, loading, addProject, editProject, removeProject, linkTeam, unlinkTeam } =
    useProjects(contractId);
  const { teams } = useAuth();

  const [activeTab, setActiveTab]           = useState<'sustentacao' | 'agil'>('sustentacao');
  const [showForm, setShowForm]             = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [linkingProject, setLinkingProject] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam]     = useState<string>('');

  // RN04: times de sustentação e ágeis disponíveis separadamente
  const sustentacaoTeams = (teams as any[]).filter(t => t.module === 'sustentacao');
  const agilTeams        = (teams as any[]).filter(t => t.module === 'sala_agil');

  // Decide quais abas mostrar conforme room_mode do contrato
  const showSustentacao = roomMode === 'sustentacao' || roomMode === 'hibrido';
  const showAgil        = roomMode === 'agil'        || roomMode === 'hibrido';

  const handleLink = async (projectId: string) => {
    if (!selectedTeam) { toast.error('Selecione um time'); return; }
    try {
      await linkTeam(projectId, selectedTeam);
      toast.success('Time vinculado ao projeto!');
      setLinkingProject(null);
      setSelectedTeam('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao vincular');
    }
  };

  const handleUnlink = async (teamId: string) => {
    if (!confirm('Desvincular este time do projeto?')) return;
    try {
      await unlinkTeam(teamId);
      toast.success('Time desvinculado.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao desvincular');
    }
  };

  const handleArchive = async (projectId: string, name: string) => {
    if (!confirm(`Arquivar o projeto "${name}"?`)) return;
    try {
      await removeProject(projectId);
      toast.success('Projeto arquivado.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao arquivar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando projetos...
      </div>
    );
  }

  // Filtra projetos por room_type conforme aba ativa
  const filteredProjects = projects.filter((p: any) => {
    if (activeTab === 'sustentacao') return p.room_type === 'sustentacao' || !p.room_type;
    return p.room_type === 'agil';
  });

  const renderProjectList = (teamsPool: any[]) => (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Novo Projeto
        </Button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhum projeto ativo nesta sala.
          </p>
        </div>
      ) : (
        filteredProjects.map((project: any) => {
          const moduleCfg      = MODULE_CONFIG[project.module_type as keyof typeof MODULE_CONFIG]
                                  ?? MODULE_CONFIG.sustenance;
          const linkedTeamIds  = new Set((project.teams ?? []).map((t: any) => t.id));
          // RN04: permite vincular mesmo time em salas diferentes
          const availableTeams = teamsPool.filter(t => !linkedTeamIds.has(t.id));
          const isLinking      = linkingProject === project.id;

          return (
            <div key={project.id} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-semibold truncate">{project.name}</span>
                  {project.code && (
                    <span className="text-[10px] text-muted-foreground font-mono">({project.code})</span>
                  )}
                  <Badge variant="outline" className={`text-[10px] border shrink-0 ${moduleCfg.className}`}>
                    {moduleCfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setEditingProject(project)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar projeto</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleArchive(project.id, project.name)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Arquivar projeto</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => {
                          setLinkingProject(isLinking ? null : project.id);
                          setSelectedTeam('');
                        }}>
                        <Plus className="h-3 w-3" />
                        {isLinking ? 'Cancelar' : 'Time'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vincular time</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="px-4 py-2 space-y-1.5">
                {(project.teams ?? []).length === 0 && !isLinking && (
                  <p className="text-[11px] text-muted-foreground py-1">Nenhum time vinculado.</p>
                )}
                {(project.teams ?? []).map((team: any) => (
                  <div key={team.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{team.name}</span>
                      {team.team_type && (
                        <Badge variant="outline" className="text-[10px]">{team.team_type}</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlink(team.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {isLinking && (
                  <div className="flex items-center gap-2 pt-2 pb-1 border-t mt-1">
                    {availableTeams.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">Nenhum time disponível.</p>
                    ) : (
                      <>
                        <Select value={selectedTeam || '_none'}
                          onValueChange={v => setSelectedTeam(v === '_none' ? '' : v)}>
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            <SelectValue placeholder="Selecione o time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecione...</SelectItem>
                            {availableTeams.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8 text-xs px-3"
                          disabled={!selectedTeam}
                          onClick={() => handleLink(project.id)}>
                          Vincular
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-3">

        {/* RN02/RN04: Abas por tipo de sala — só mostra abas relevantes ao room_mode */}
        {showSustentacao && showAgil ? (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="sustentacao" className="flex-1 gap-1">
                <Wrench className="h-3.5 w-3.5" /> Sustentação
              </TabsTrigger>
              <TabsTrigger value="agil" className="flex-1 gap-1">
                <Zap className="h-3.5 w-3.5" /> Ágil
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sustentacao" className="mt-3">
              <div className="flex items-start gap-2 rounded-lg bg-purple-950/30 border border-purple-800/40 px-3 py-2 mb-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
                <p className="text-[11px] text-purple-300">
                  Times de sustentação têm SLA contratual. O compliance é monitorado no painel.
                </p>
              </div>
              {renderProjectList(sustentacaoTeams)}
            </TabsContent>
            <TabsContent value="agil" className="mt-3">
              <div className="flex items-start gap-2 rounded-lg bg-blue-950/30 border border-blue-800/40 px-3 py-2 mb-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                <p className="text-[11px] text-blue-300">
                  Times ágeis não possuem SLA contratual neste módulo.
                </p>
              </div>
              {renderProjectList(agilTeams)}
            </TabsContent>
          </Tabs>
        ) : showSustentacao ? (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-purple-950/30 border border-purple-800/40 px-3 py-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
              <p className="text-[11px] text-purple-300">
                Apenas <strong>salas de sustentação</strong> podem ser vinculadas a contratos com SLA.
              </p>
            </div>
            {renderProjectList(sustentacaoTeams)}
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-blue-950/30 border border-blue-800/40 px-3 py-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
              <p className="text-[11px] text-blue-300">
                Contrato ágil puro — SLA não aplicável a estes projetos.
              </p>
            </div>
            {renderProjectList(agilTeams)}
          </>
        )}

        {showForm && (
          <ProjectForm
            contractId={contractId}
            onClose={() => setShowForm(false)}
            onSuccess={() => setShowForm(false)}
            onSubmit={async (input: ProjectInput) => { await addProject(input); }}
          />
        )}
        {editingProject && (
          <ProjectForm
            contractId={contractId}
            initialData={editingProject}
            onClose={() => setEditingProject(null)}
            onSuccess={() => setEditingProject(null)}
            onSubmit={async (input: ProjectInput) => { await editProject(editingProject.id, input); }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
