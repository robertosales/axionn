import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Users, UserCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";

interface TeamMemberInfo {
  user_id: string;
  role: string;
  display_name: string;
  email: string;
}

interface TeamManagerProps {
  moduleFilter?: "sala_agil" | "sustentacao";
}

export function TeamManager({ moduleFilter }: TeamManagerProps) {
  const { teams, refreshTeams, currentTeamId, setCurrentTeamId, isAdmin, hasPermission } = useAuth();
  const { currentOrganizationId } = useOrganization();
  const canManage = hasPermission("manage_teams");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState<string>(moduleFilter || "sala_agil");
  const [open, setOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<{
    id: string;
    name: string;
    description: string;
    module: string;
  } | null>(null);
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberInfo[]>>({});
  const [allTeams, setAllTeams] = useState<any[]>([]);
  // IDs dos cards com membros expandidos
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleExpanded = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  };

  const loadTeams = async () => {
    const accessibleTeams = teams
      .filter((team) => !moduleFilter || team.module === moduleFilter)
      .slice()
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      );

    if (accessibleTeams.length > 0) {
      setAllTeams(accessibleTeams);
      loadTeamMembers(accessibleTeams.map((team) => team.id));
      return;
    }

    let query = supabase
      .from("teams")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (moduleFilter) query = query.eq("module", moduleFilter);

    const { data, error } = await query;
    if (error) {
      console.error("[TeamManager] loadTeams:", error);
      setAllTeams([]);
      setTeamMembers({});
      return;
    }

    setAllTeams(data || []);
    if (data && data.length > 0) loadTeamMembers(data.map((t: any) => t.id));
    else setTeamMembers({});
  };

  const loadTeamMembers = async (teamIds: string[]) => {
    if (teamIds.length === 0) {
      setTeamMembers({});
      return;
    }

    if (currentOrganizationId) {
      const { data: rpcMembers, error: rpcError } = await (supabase as any).rpc(
        "get_team_members_for_teams_v2",
        {
          p_org_id: currentOrganizationId,
          p_team_ids: teamIds,
        },
      );

      if (!rpcError && rpcMembers) {
        const result: Record<string, TeamMemberInfo[]> = {};
        for (const member of rpcMembers as any[]) {
          if (!member.team_id || !member.user_id) continue;
          if (!result[member.team_id]) result[member.team_id] = [];
          result[member.team_id].push({
            user_id: member.user_id,
            role: member.role || "member",
            display_name: member.display_name || member.email || "Usuario",
            email: member.email || "",
          });
        }
        setTeamMembers(result);
        return;
      }

      console.error("[TeamManager] get_team_members_for_teams_v2:", rpcError);
    }

    const { data: tmData, error: tmError } = await supabase
      .from("team_members")
      .select("team_id, user_id, role")
      .in("team_id", teamIds);

    if (tmError) {
      console.error("[TeamManager] loadTeamMembers:", tmError);
    }

    if (tmError || !tmData || tmData.length === 0) {
      const { data: profileMembers, error: profileError } = await supabase
        .from("profiles")
        .select("team_id, user_id, display_name, email")
        .in("team_id", teamIds)
        .eq("is_active", true);

      if (profileError || !profileMembers || profileMembers.length === 0) {
        if (profileError) console.error("[TeamManager] loadProfileMembers:", profileError);
        setTeamMembers({});
        return;
      }

      const result: Record<string, TeamMemberInfo[]> = {};
      for (const profile of profileMembers as any[]) {
        if (!profile.team_id || !profile.user_id) continue;
        if (!result[profile.team_id]) result[profile.team_id] = [];
        result[profile.team_id].push({
          user_id: profile.user_id,
          role: "member",
          display_name: profile.display_name || "Usuario",
          email: profile.email || "",
        });
      }

      setTeamMembers(result);
      return;
    }

    if (tmData.length === 0) {
      setTeamMembers({});
      return;
    }

    const userIds = [...new Set(tmData.map((m: any) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const result: Record<string, TeamMemberInfo[]> = {};
    for (const tm of tmData) {
      const profile = profileMap.get(tm.user_id);
      const info: TeamMemberInfo = {
        user_id: tm.user_id,
        role: tm.role,
        display_name: profile?.display_name || "Usuário",
        email: profile?.email || "",
      };
      if (!result[tm.team_id]) result[tm.team_id] = [];
      result[tm.team_id].push(info);
    }
    setTeamMembers(result);
  };

  useEffect(() => {
    loadTeams();
  }, [moduleFilter, teams, currentOrganizationId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nome do time é obrigatório *");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("teams")
      .insert({
        name: name.trim(),
        description: description.trim(),
        created_by: user.id,
        module: module,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar time");
      return;
    }

    await supabase.from("team_members").insert({
      team_id: (data as any).id,
      user_id: user.id,
      role: "admin",
    });

    if (module === "sala_agil") {
      const defaultCols = [
        { key: "aguardando_desenvolvimento", label: "Aguardando Desenvolvimento", color_class: "bg-kanban-aguardando", dot_color: "bg-muted-foreground", sort_order: 0 },
        { key: "em_desenvolvimento", label: "Em Desenvolvimento", color_class: "bg-kanban-desenvolvimento", dot_color: "bg-info", sort_order: 1 },
        { key: "em_code_review", label: "Em Code Review", color_class: "bg-kanban-review", dot_color: "bg-accent", sort_order: 2 },
        { key: "em_teste", label: "Em Teste", color_class: "bg-kanban-teste", dot_color: "bg-warning", sort_order: 3 },
        { key: "bug", label: "Bug", color_class: "bg-kanban-bug", dot_color: "bg-destructive", sort_order: 4 },
        { key: "pronto_para_publicacao", label: "Pronto para Publicação", color_class: "bg-kanban-pronto", dot_color: "bg-success", sort_order: 5 },
      ];
      await supabase.from("workflow_columns").insert(defaultCols.map((c) => ({ ...c, team_id: (data as any).id })));
    }

    toast.success("Time criado com sucesso!");
    setName("");
    setDescription("");
    setModule(moduleFilter || "sala_agil");
    setOpen(false);
    await refreshTeams();
    await loadTeams();
    setCurrentTeamId((data as any).id);
  };

  const handleUpdate = async () => {
    if (!editingTeam) return;
    const { error } = await supabase
      .from("teams")
      .update({
        name: editingTeam.name,
        description: editingTeam.description,
        module: editingTeam.module,
      } as any)
      .eq("id", editingTeam.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success("Time atualizado!");
    setEditingTeam(null);
    await refreshTeams();
    await loadTeams();
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from("teams").delete().eq("id", deleteTarget);
      toast.success("Registro excluído com sucesso");
      await refreshTeams();
      await loadTeams();
      if (currentTeamId === deleteTarget) setCurrentTeamId(allTeams.find((t) => t.id !== deleteTarget)?.id || null);
    } catch {
      toast.error("Falha ao excluir item");
    }
    setDeleteTarget(null);
  };

  const MODULE_LABELS: Record<string, string> = { sala_agil: "Sala Ágil", sustentacao: "Sustentação" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Times / Squads
          </h2>
          <p className="text-sm text-muted-foreground">
            {moduleFilter ? `Times do módulo ${MODULE_LABELS[moduleFilter]}` : "Gerencie os times do projeto"}
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Time</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Squad Alpha" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição do time"
                  />
                </div>
                {!moduleFilter && (
                  <div>
                    <Label>Tipo de Time *</Label>
                    <Select value={module} onValueChange={setModule}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sala_agil">Sala Ágil</SelectItem>
                        <SelectItem value="sustentacao">Sustentação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} className="w-full">Criar Time</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allTeams.map((team) => {
          const members = teamMembers[team.id] || [];
          const isExpanded = expandedTeams.has(team.id);
          const isActive = currentTeamId === team.id;

          return (
            <Card
              key={team.id}
              className={`transition-all ${
                isActive ? "ring-2 ring-primary" : "hover:shadow-md"
              }`}
            >
              {/* Header — clica para selecionar time ativo */}
              <CardHeader
                className="flex flex-row items-center justify-between pb-2 cursor-pointer"
                onClick={() => setCurrentTeamId(team.id)}
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <CardTitle className="text-lg leading-tight">{team.name}</CardTitle>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {MODULE_LABELS[team.module] || team.module}
                    </Badge>
                    {isActive && (
                      <span className="text-[10px] text-primary font-semibold">● Ativo</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTeam({
                          id: team.id,
                          name: team.name,
                          description: team.description || "",
                          module: team.module || "sala_agil",
                        });
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(team.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Botão toggle membros */}
              <CardContent className="pt-0 pb-3 space-y-2">
                <button
                  onClick={(e) => toggleExpanded(team.id, e)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors border border-border/50"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {members.length} membro{members.length !== 1 ? "s" : ""}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {/* Lista de membros — expandível */}
                {isExpanded && (
                  <div className="space-y-1.5 pt-1 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {members.length > 0 ? (
                      members.map((m) => (
                        <div key={m.user_id} className="flex items-center gap-2 text-xs px-1">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate flex-1">{m.display_name}</span>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{m.role}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-muted-foreground px-1 py-0.5">Nenhum membro cadastrado.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allTeams.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum time encontrado"
          description="Utilize o botão acima para criar seu primeiro time."
        />
      )}

      <Dialog open={!!editingTeam} onOpenChange={(o) => !o && setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Time</DialogTitle></DialogHeader>
          {editingTeam && (
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editingTeam.description}
                  onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })}
                />
              </div>
              {!moduleFilter && (
                <div>
                  <Label>Tipo de Time</Label>
                  <Select
                    value={editingTeam.module}
                    onValueChange={(v) => setEditingTeam({ ...editingTeam, module: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sala_agil">Sala Ágil</SelectItem>
                      <SelectItem value="sustentacao">Sustentação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleUpdate} className="w-full">Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar exclusão"
        description="Excluir este time? Todos os dados associados serão perdidos. Esta ação não poderá ser desfeita."
      />
    </div>
  );
}
