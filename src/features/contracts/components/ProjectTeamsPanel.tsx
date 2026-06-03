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
import { toast } from 'sonner';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import {
  FolderKanban, Plus, Trash2, Loader2,
  Archive, Edit2, Users,
} from 'lucide-react';
import { ProjectForm } from './ProjectForm';
import type { Project, ProjectInput } from '../services/projects.service';

const MODULE_CONFIG = {
  sustenance: { label: '🛠 Sustentação', className: 'bg-purple-950 text-purple-300 border-purple-800' },
  agile:      { label: '⚡ Ágil',        className: 'bg-blue-950   text-blue-300   border-blue-800'   },
  mixed:      { label: '🔀 Misto',       className: 'bg-orange-950 text-orange-300 border-orange-800' },
};

interface Props {
  contractId: string;
}

export function ProjectTeamsPanel({ contractId }: Props) {
  const { projects, loading, addProject, editProject, removeProject, linkTeam, unlinkTeam } =
    useProjects(contractId);
  const { teams } = useAuth();

  const [showForm, setShowForm]     = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [linkingProject, setLinkingProject] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam]     = useState<string>('');

  const handleLink = async (projectId: string) => {
    if (!selectedTeam) { toast.error('Selecione um time'); return; }
    try {
      await linkTeam(projectId, selectedTeam);
      toast.success('Time vinculado!');
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

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Botão novo projeto */}
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> Novo Projeto
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
            <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum projeto ativo neste contrato.</p>
          </div>
        ) : (
          projects.map(project => {
            const moduleCfg       = MODULE_CONFIG[project.module_type];
            const linkedTeamIds   = new Set((project.teams ?? []).map(t => t.id));
            const availableTeams  = teams.filter(t => !linkedTeamIds.has(t.id));
            const isLinking       = linkingProject === project.id;

            return (
              <div key={project.id} className="rounded-lg border bg-card">
                {/* Header do projeto */}
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                      onClick={() => {
                        setLinkingProject(isLinking ? null : project.id);
                        setSelectedTeam('');
                      }}>
                      <Plus className="h-3 w-3" />
                      {isLinking ? 'Cancelar' : 'Time'}
                    </Button>
                  </div>
                </div>

                {/* Times vinculados */}
                <div className="px-4 py-2 space-y-1.5">
                  {(project.teams ?? []).length === 0 && !isLinking && (
                    <p className="text-[11px] text-muted-foreground py-1">
                      Nenhum time vinculado.
                    </p>
                  )}
                  {(project.teams ?? []).map(team => (
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

                  {/* Mini-form vincular time */}
                  {isLinking && (
                    <div className="flex items-center gap-2 pt-2 pb-1 border-t mt-1">
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
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Form novo projeto */}
        {showForm && (
          <ProjectForm
            contractId={contractId}
            onClose={() => setShowForm(false)}
            onSuccess={() => setShowForm(false)}
            onSubmit={async (input) => { await addProject(input); }}
          />
        )}

        {/* Form editar projeto */}
        {editingProject && (
          <ProjectForm
            contractId={contractId}
            initialData={editingProject}
            onClose={() => setEditingProject(null)}
            onSuccess={() => setEditingProject(null)}
            onSubmit={async (input) => { await editProject(editingProject.id, input); }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
