import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useTeamManagementPermissions } from "@/features/admin/hooks/useTeamManagementPermissions";
import { resolveOrganizationOperationalError } from "@/features/organization/utils/operationalErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Users, UserPlus, Shield, Search, Filter, ArrowUpDown, Calendar, Code2, Pencil, AlertCircle, RefreshCw } from "lucide-react";
import { getRoleLabel, type AppRole } from "@/hooks/usePermissions";
import { getInitials } from "@/lib/nameUtils";
import { groupTeamMembershipsByUser } from "@/lib/teamMemberships";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { SkeletonList } from "@/shared/components/common/SkeletonList";

const PREDEFINED_ROLES = [
  "Analista de Requisitos",
  "Arquiteto de Software",
  "Desenvolvedor Fullstack",
  "Designer UX/UI",
  "QA / Tester",
  "Scrum Master",
];

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { display_name: string; email: string };
  user_roles?: AppRole[];
}

interface ProfileCandidate {
  user_id: string;
  display_name: string;
  email: string;
  teams: { id: string; name: string; module: string; role: string }[];
}

const MODULE_LABELS: Record<string, string> = {
  sala_agil: "Sala Ágil",
  sustentacao: "Sustentação",
  rdm: "RDM",
};

export function TeamMembersManager() {
  const { currentTeamId, isAdmin, teams } = useAuth();
  const { currentOrganizationId, enabled: orgEnabled } = useOrganization();
  const permissions = useTeamManagementPermissions();
  const canAdd = permissions.canAddTeamMember;
  const canUpdate = permissions.canUpdateTeamMember;
  const canRemove = permissions.canRemoveTeamMember;
  const canManage = canAdd || canUpdate || canRemove;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState("Desenvolvedor Fullstack");
  const [customRole, setCustomRole] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "recent" | "oldest">("name");
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCustomRole, setEditCustomRole] = useState("");
  const [editUsesCustomRole, setEditUsesCustomRole] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const fetchMembers = async () => {
    if (!currentTeamId) return;
    setLoading(true);
    setLoadError(null);

    if (orgEnabled && currentOrganizationId) {
      const { data: rpcMembers, error: rpcError } = await (supabase as any).rpc(
        "get_organization_team_members_v2",
        { p_org_id: currentOrganizationId, p_team_id: currentTeamId },
      );
      if (!rpcError) {
        setMembers(
          ((rpcMembers || []) as any[]).map((row) => ({
            id: String(row.team_member_id),
            user_id: String(row.user_id),
            role: String(row.role ?? "member"),
            joined_at: String(row.joined_at ?? ""),
            profile: {
              display_name: String(row.display_name ?? ""),
              email: String(row.email ?? ""),
            },
            user_roles: row.membership_role === "owner" || row.membership_role === "admin"
              ? (["admin"] as AppRole[])
              : [],
          })),
        );
        setLoading(false);
        return;
      }
      if (rpcError) {
        console.error(
          "[TeamMembersManager] get_organization_team_members_v2:",
          rpcError,
        );
        setMembers([]);
        setLoadError(
          resolveOrganizationOperationalError(
            rpcError,
            "Não foi possível carregar os membros deste time.",
          ),
        );
        setLoading(false);
        return;
      }
    }

    const { data: tmData, error: teamMembersError } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", currentTeamId);

    if (teamMembersError) {
      setMembers([]);
      setLoadError("Não foi possível carregar os membros deste time.");
      setLoading(false);
      return;
    }

    const memberList = tmData || [];
    const userIds = memberList.map((m: any) => m.user_id);

    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      profiles = pData || [];
    }

    let userRoles: any[] = [];
    if (userIds.length > 0 && isAdmin) {
      const { data: rData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      userRoles = rData || [];
    }

    setMembers(
      memberList.map((m: any) => ({
        ...m,
        profile: profiles.find((p: any) => p.user_id === m.user_id),
        user_roles: userRoles
          .filter((r: any) => r.user_id === m.user_id)
          .map((r: any) => r.role as AppRole),
      }))
    );
    setLoading(false);
  };

  const fetchAllProfiles = async () => {
    if (!canAdd) return;
    setProfilesError(null);

    if (orgEnabled && currentOrganizationId) {
      const { data: orgMembers, error: orgError } = await (supabase as any).rpc(
        "get_organization_members_v2",
        { p_org_id: currentOrganizationId },
      );
      if (!orgError) {
        const organizationTeams = teams.filter(
          (team) => !team.organizationId || team.organizationId === currentOrganizationId,
        );
        let membershipsByUser = new Map<string, ProfileCandidate["teams"]>();
        if (organizationTeams.length > 0) {
          const { data: memberships, error: membershipsError } = await supabase.rpc(
            "get_team_members_for_teams_v2",
            {
              p_org_id: currentOrganizationId,
              p_team_ids: organizationTeams.map((team) => team.id),
            },
          );
          if (membershipsError) {
            console.error("[TeamMembersManager] get_team_members_for_teams_v2:", membershipsError);
            setAllProfiles([]);
            setProfilesError(
              resolveOrganizationOperationalError(
                membershipsError,
                "Não foi possível carregar as participações das pessoas.",
              ),
            );
            return;
          } else {
            membershipsByUser = groupTeamMembershipsByUser(organizationTeams, memberships || []);
          }
        }
        setAllProfiles(
          ((orgMembers || []) as any[])
            .filter((row) => row.is_active !== false)
            .map((row) => ({
              user_id: String(row.user_id),
              display_name: String(row.display_name ?? row.email ?? "Usuário"),
              email: String(row.email ?? ""),
              teams: membershipsByUser.get(String(row.user_id)) || [],
            })),
        );
        return;
      }
      if (orgError) {
        console.error(
          "[TeamMembersManager] get_organization_members_v2:",
          orgError,
        );
        setAllProfiles([]);
        setProfilesError(
          resolveOrganizationOperationalError(
            orgError,
            "Não foi possível carregar as pessoas da organização.",
          ),
        );
        return;
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .eq("is_active", true);
    if (error) {
      setAllProfiles([]);
      setProfilesError("Não foi possível carregar as pessoas disponíveis.");
      return;
    }
    setAllProfiles((data || []).map((profile) => ({ ...profile, teams: [] })));
  };

  useEffect(() => {
    fetchMembers();
    fetchAllProfiles();
  }, [currentTeamId, currentOrganizationId, orgEnabled, teams]);

  const handleAddMember = async () => {
    if (!currentTeamId || !selectedUserId) {
      toast.error("Selecione um usuário");
      return;
    }
    if (!canAdd) {
      toast.error(
        permissions.writeBlockedReason ??
          "Você não tem permissão para gerenciar membros deste time.",
      );
      return;
    }
    const exists = members.find((m) => m.user_id === selectedUserId);
    if (exists) {
      toast.error("Usuário já é membro deste time");
      return;
    }
    const finalRole = showCustom ? customRole.trim() : memberRole;
    if (!finalRole) {
      toast.error("Informe a função do membro");
      return;
    }

    if (orgEnabled && currentOrganizationId) {
      const { error: rpcError } = await (supabase as any).rpc(
        "add_organization_team_member_v2",
        {
          p_org_id: currentOrganizationId,
          p_team_id: currentTeamId,
          p_user_id: selectedUserId,
          p_role: finalRole,
        },
      );
      if (rpcError) {
        console.error("[TeamMembersManager] add_organization_team_member_v2:", rpcError);
        toast.error(
          resolveOrganizationOperationalError(rpcError, "Erro ao adicionar membro"),
        );
        return;
      }
    } else {
      const { error } = await supabase.from("team_members").insert({
        team_id: currentTeamId,
        user_id: selectedUserId,
        role: finalRole,
      });
      if (error) {
        toast.error("Erro ao adicionar membro");
        return;
      }
    }

    toast.success("Membro adicionado ao time!");
    setSelectedUserId("");
    setCustomRole("");
    setShowCustom(false);
    setOpen(false);
    await fetchMembers();
  };

  const handleRemoveMember = async (id: string) => {
    if (!canRemove) {
      toast.error(
        permissions.writeBlockedReason ??
          "Você não tem permissão para gerenciar membros deste time.",
      );
      return;
    }
    if (orgEnabled && currentOrganizationId) {
      const { error: rpcError } = await (supabase as any).rpc(
        "remove_organization_team_member_v2",
        { p_org_id: currentOrganizationId, p_team_member_id: id },
      );
      if (rpcError) {
        console.error(
          "[TeamMembersManager] remove_organization_team_member_v2:",
          rpcError,
        );
        toast.error(
          resolveOrganizationOperationalError(rpcError, "Erro ao remover membro"),
        );
        return;
      }
    } else {
      await supabase.from("team_members").delete().eq("id", id);
    }

    toast.success("Membro removido");
    setMemberToRemove(null);
    await fetchMembers();
  };

  const openRoleEditor = (member: TeamMember) => {
    const predefined = PREDEFINED_ROLES.includes(member.role);
    setMemberToEdit(member);
    setEditRole(predefined ? member.role : "");
    setEditCustomRole(predefined ? "" : member.role);
    setEditUsesCustomRole(!predefined);
  };

  const closeRoleEditor = () => {
    if (savingRole) return;
    setMemberToEdit(null);
    setEditRole("");
    setEditCustomRole("");
    setEditUsesCustomRole(false);
  };

  const handleUpdateMemberRole = async () => {
    if (!memberToEdit || !currentTeamId) return;
    if (!canUpdate) {
      toast.error(
        permissions.writeBlockedReason ??
          "Você não tem permissão para gerenciar membros deste time.",
      );
      return;
    }

    const nextRole = (editUsesCustomRole ? editCustomRole : editRole).trim();
    if (!nextRole) {
      toast.error("Informe a função do membro");
      return;
    }
    if (nextRole === memberToEdit.role) {
      closeRoleEditor();
      return;
    }

    setSavingRole(true);
    try {
      if (orgEnabled && currentOrganizationId) {
        const { error: rpcError } = await supabase.rpc(
          "update_organization_team_member_role_v2",
          {
            p_org_id: currentOrganizationId,
            p_team_member_id: memberToEdit.id,
            p_role: nextRole,
          },
        );
        if (rpcError) {
          console.error("[TeamMembersManager] update_organization_team_member_role_v2:", rpcError);
          toast.error(
            resolveOrganizationOperationalError(rpcError, "Erro ao atualizar função"),
          );
          return;
        }
      } else {
        const { error } = await supabase
          .from("team_members")
          .update({ role: nextRole })
          .eq("id", memberToEdit.id)
          .eq("team_id", currentTeamId);
        if (error) {
          toast.error("Erro ao atualizar função");
          return;
        }
      }

      toast.success("Função no time atualizada");
      setMemberToEdit(null);
      await fetchMembers();
    } finally {
      setSavingRole(false);
    }
  };

  const availableProfiles = allProfiles.filter(
    (p) => !members.find((m) => m.user_id === p.user_id)
  );
  const selectedProfile = availableProfiles.find((profile) => profile.user_id === selectedUserId);
  const activeTeam = teams.find((team) => team.id === currentTeamId);
  const activeModuleLabel = activeTeam ? MODULE_LABELS[activeTeam.module] || activeTeam.module : "Módulo";

  const filteredMembers = members.filter((m) => {
    const term = search.toLowerCase();
    const matchesTerm =
      !term ||
      m.profile?.display_name?.toLowerCase().includes(term) ||
      m.profile?.email?.toLowerCase().includes(term) ||
      m.role?.toLowerCase().includes(term);
    const matchesRole =
      roleFilter === "all" || m.role === roleFilter;
    return matchesTerm && matchesRole;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortBy === "name") {
      return (a.profile?.display_name || "").localeCompare(
        b.profile?.display_name || "",
        "pt-BR",
      );
    }
    const da = new Date(a.joined_at).getTime();
    const db = new Date(b.joined_at).getTime();
    return sortBy === "recent" ? db - da : da - db;
  });

  const totalMembers = members.length;
  const totalAdmins = members.filter((m) =>
    m.user_roles?.includes("admin" as AppRole),
  ).length;
  const totalDevs = members.filter((m) =>
    /desenvolvedor|developer|dev\b/i.test(m.role || ""),
  ).length;
  const totalQA = members.filter((m) =>
    /qa|tester|quality/i.test(m.role || ""),
  ).length;

  const uniqueRoles = Array.from(
    new Set(members.map((m) => m.role).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (!currentTeamId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione um time para gerenciar membros</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Membros do Time</h2>
            {activeTeam && <Badge variant="secondary">{activeTeam.name} · {activeModuleLabel}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie as participações neste time. A identidade e os outros vínculos da pessoa são preservados.
          </p>
        </div>

        {canAdd && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-11 sm:min-h-9">
                <UserPlus className="h-4 w-4 mr-2" /> Adicionar Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Membro ao Time</DialogTitle>
                <DialogDescription>
                  Selecione uma pessoa já cadastrada na organização. Esta ação cria apenas um novo vínculo com o time atual.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {profilesError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3" role="alert">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="space-y-2">
                        <p className="text-sm text-foreground">{profilesError}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => void fetchAllProfiles()}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="team-member-user">Usuário *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="team-member-user" className="min-h-11">
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.display_name} ({p.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProfile && (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3" aria-live="polite">
                      <p className="text-xs font-medium text-foreground">Participações atuais</p>
                      {selectedProfile.teams.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedProfile.teams.map((team) => (
                            <Badge key={team.id} variant="outline" className="font-normal">
                              {team.name} · {MODULE_LABELS[team.module] || team.module} · {team.role}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Esta será a primeira participação da pessoa em um time.</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Função no Time *</Label>
                  {!showCustom ? (
                    <Select
                      value={memberRole}
                      onValueChange={(v) => {
                        if (v === "__custom__") {
                          setShowCustom(true);
                          setMemberRole("");
                        } else {
                          setMemberRole(v);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PREDEFINED_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          <span className="text-primary font-medium">
                            + Outra função...
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        placeholder="Digite a função personalizada"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustom(false);
                          setMemberRole("Desenvolvedor Fullstack");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>

                <Button onClick={handleAddMember} className="w-full">
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatPill dotClass="bg-blue-500" value={totalMembers} label={totalMembers === 1 ? "membro" : "membros"} />
        <StatPill dotClass="bg-emerald-500" value={totalAdmins} label="admins" />
        <StatPill dotClass="bg-green-500" value={totalDevs} label="devs ativos" />
        <StatPill dotClass="bg-yellow-500" value={totalQA} label="QA" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 rounded-full bg-card"
            placeholder="Buscar por nome, e-mail ou função…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px] rounded-full bg-card">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            {uniqueRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-[160px] rounded-full bg-card">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {loading && <SkeletonList count={4} variant="row" />}
        {loadError && !loading && (
          <Card className="border-destructive/40 bg-destructive/5" role="alert">
            <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">Falha ao carregar membros</p>
                  <p className="text-sm text-muted-foreground">{loadError}</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void fetchMembers()} className="min-h-11 sm:min-h-9">
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
        {!loading && !loadError && sortedMembers.map((member) => {
          const name = member.profile?.display_name || "Usuário";
          return (
            <Card
              key={member.id}
              className="rounded-2xl border-border/60 hover:border-border transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                    {getInitials(name)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.profile?.email}
                        </p>
                      </div>
                      {canManage && (
                        <div className="-mr-1 -mt-1 flex items-center gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11"
                              onClick={() => openRoleEditor(member)}
                              aria-label={`Editar função de ${name} no time ${activeTeam?.name || "atual"}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11"
                              onClick={() => setMemberToRemove(member)}
                              aria-label={`Remover ${name} do time ${activeTeam?.name || "atual"}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="rounded-full font-normal">
                        {member.role}
                      </Badge>
                      {member.user_roles?.map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="rounded-full font-normal"
                        >
                          {role === "admin" ? (
                            <Shield className="h-3 w-3 mr-1" />
                          ) : role === "developer" ? (
                            <Code2 className="h-3 w-3 mr-1" />
                          ) : (
                            <Users className="h-3 w-3 mr-1" />
                          )}
                          {getRoleLabel(role)}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/60">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Desde{" "}
                        {new Date(member.joined_at).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Ativo
                      </span>
      </div>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setMemberToRemove(null); }}
        title="Remover participação do time?"
        description={`O vínculo de ${memberToRemove?.profile?.display_name || "esta pessoa"} será removido apenas de ${activeTeam?.name || "este time"} (${activeModuleLabel}). A identidade, os perfis RBAC e as participações em outros times serão preservados.`}
        confirmLabel="Remover deste time"
        onConfirm={() => { if (memberToRemove) void handleRemoveMember(memberToRemove.id); }}
      />

      <Dialog open={Boolean(memberToEdit)} onOpenChange={(nextOpen) => { if (!nextOpen) closeRoleEditor(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar função no time</DialogTitle>
            <DialogDescription>
              Altere apenas a função de {memberToEdit?.profile?.display_name || "esta pessoa"} em {activeTeam?.name || "este time"} ({activeModuleLabel}). A identidade, os perfis RBAC e os outros vínculos não serão modificados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="edit-team-member-role">Função no time *</Label>
            {!editUsesCustomRole ? (
              <Select
                value={editRole}
                onValueChange={(value) => {
                  if (value === "__custom__") {
                    setEditUsesCustomRole(true);
                    setEditCustomRole("");
                  } else {
                    setEditRole(value);
                  }
                }}
              >
                <SelectTrigger id="edit-team-member-role" className="min-h-11">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Outra função...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  id="edit-team-member-role"
                  className="min-h-11"
                  value={editCustomRole}
                  onChange={(event) => setEditCustomRole(event.target.value)}
                  placeholder="Digite a função personalizada"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    setEditUsesCustomRole(false);
                    setEditRole(PREDEFINED_ROLES[0]);
                  }}
                >
                  Escolher uma função predefinida
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRoleEditor} disabled={savingRole}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleUpdateMemberRole()} disabled={savingRole}>
              {savingRole ? "Salvando..." : "Salvar função"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sortedMembers.length === 0 && !loading && !loadError && (
        <Card className="border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {search
              ? `Nenhum membro encontrado para "${search}".`
              : "Nenhum membro neste time ainda."}
          </p>
        </Card>
      )}
    </div>
  );
}

function StatPill({
  dotClass,
  value,
  label,
}: {
  dotClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/60 bg-card text-sm">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
