import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useProjectsByContract } from '../hooks/useProjectTeams';
import { useAuth } from '@/contexts/AuthContext';
import {
  FolderKanban, Plus, Trash2, Loader2,
  Zap, Wrench, Users,
} from 'lucide-react';
import type { ProjectTeamRole } from '../services/project_teams.service';

const ROLE_CONFIG: Record<ProjectTeamRole, { label: string; icon: typeof Zap; className: string }> = {
  agile:       { label: '⚡ Ágil',         icon: Zap,    className: 'bg-blue-950 text-blue-300 border-blue-800'   },
  sustentacao: { label: '🛠 Sustentação', icon: Wrench, className: 'bg-purple-950 text-purple-300 border-purple-800' },
};

interface Props {
  contractId: string;
}

export function ProjectTeamsPanel({ contractId }: Props) {
  const { projects, loading, linkTeam, unlinkTeam } = useProjectsByContract(contractId);
  const { teams } = useAuth();

  // estado do mini-form de vinculo por projeto
  const [linking, setLinking] = useState<Record<string, { teamId: string; role: ProjectTeamRole; saving: boolean }>>({});
  const [showFormFor, setShowFormFor] = useState<string | null>(null);

  const initLink = (projectId: string) => {
    setLinking(prev => ({
      ...prev,
      [projectId]: { teamId: '', role: 'sustentacao', saving: false },
    }));
    setShowFormFor(projectId);
  };

  const setLinkField = (
    projectId: string,
    field: 'teamId' | 'role',
    value: string,
  ) => {
    setLinking(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value },
    }));
  };

  const handleLink = async (projectId: string) => {
    const state = linking[projectId];
    if (!state?.teamId) { toast.error('Selecione um time'); return; }
    setLinking(prev => ({ ...prev, [projectId]: { ...prev[projectId], saving: true } }));
    try {
      await linkTeam(projectId, state.teamId, state.role);
      toast.success('Time vinculado com sucesso!');
      setShowFormFor(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao vincular time');
    } finally {
      setLinking(prev => ({ ...prev, [projectId]: { ...prev[projectId], saving: false } }));
    }
  };

  const handleUnlink = async (projectTeamId: string) => {
    if (!confirm('Desvincular este time do projeto?')) return;
    try {
      await unlinkTeam(projectTeamId);
      toast.success('Time desvinculado.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao desvincular');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando projetos...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
        <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">
          Nenhum projeto vinculado a este contrato ainda.
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          Acesse <strong>Projetos</strong> no módulo de Sustentação e vincule ao contrato.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map(project => {
        const isShowingForm = showFormFor === project.id;
        const linkState     = linking[project.id];

        // Times já vinculados a este projeto (para não exibir no select)
        const linkedTeamIds = new Set(project.project_teams.map(pt => pt.team_id));
        const availableTeams = teams.filter(t => !linkedTeamIds.has(t.id));

        return (
          <div key={project.id} className="rounded-lg border bg-card">
            {/* Cabeçalho do projeto */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{project.nome}</span>
                {project.sla && (
                  <Badge variant="outline" className="text-[10px]">{project.sla}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => isShowingForm ? setShowFormFor(null) : initLink(project.id)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {isShowingForm ? 'Cancelar' : 'Vincular time'}
              </Button>
            </div>

            {/* Times já vinculados */}
            <div className="px-4 py-2 space-y-1.5">
              {project.project_teams.length === 0 && !isShowingForm && (
                <p className="text-[11px] text-muted-foreground py-1">
                  Nenhum time vinculado. Clique em &quot;Vincular time&quot;.
                </p>
              )}
              {project.project_teams.map(pt => {
                const roleCfg = ROLE_CONFIG[pt.role];
                return (
                  <div
                    key={pt.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{pt.team_name ?? pt.team_id}</span>
                      <Badge className={`text-[10px] border ${roleCfg.className}`}>
                        {roleCfg.label}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlink(pt.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}

              {/* Mini-form de vinculação */}
              {isShowingForm && linkState && (
                <div className="flex items-center gap-2 pt-2 pb-1 border-t mt-1">
                  <Select
                    value={linkState.teamId || '_none'}
                    onValueChange={v => setLinkField(project.id, 'teamId', v === '_none' ? '' : v)}
                  >
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

                  <Select
                    value={linkState.role}
                    onValueChange={v => setLinkField(project.id, 'role', v)}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agile">⚡ Ágil</SelectItem>
                      <SelectItem value="sustentacao">🛠 Sustentação</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => handleLink(project.id)}
                    disabled={linkState.saving || !linkState.teamId}
                  >
                    {linkState.saving
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : 'Vincular'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
