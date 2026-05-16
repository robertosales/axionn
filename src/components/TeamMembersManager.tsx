import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Users, UserPlus, Shield, Search, Filter, ArrowUpDown, Calendar, Code2 } from "lucide-react";
import { getRoleLabel, type AppRole } from "@/hooks/usePermissions";
import { getInitials } from "@/lib/nameUtils";

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

export function TeamMembersManager() {
  const { currentTeamId, hasPermission, isAdmin } = useAuth();
  const canManage = hasPermission("manage_teams");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allProfiles, setAllProfiles] = useState<
    { user_id: string; display_name: string; email: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState("Desenvolvedor Fullstack");
  const [customRole, setCustomRole] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "recent" | "oldest">("name");

  const fetchMembers = async () => {
    if (!currentTeamId) return;
    setLoading(true);
    const { data: tmData } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", currentTeamId);

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
    if (!isAdmin) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, email");
    setAllProfiles(data || []);
  };

  useEffect(() => {
    fetchMembers();
    fetchAllProfiles();
  }, [currentTeamId]);

  const handleAddMember = async () => {
    if (!currentTeamId || !selectedUserId) {
      toast.error("Selecione um usuário");
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
    const { error } = await supabase.from("team_members").insert({
      team_id: currentTeamId,
      user_id: selectedUserId,
      role: finalRole,
    });
    if (error) {
      toast.error("Erro ao adicionar membro");
      return;
    }
    toast.success("Membro adicionado ao time!");
    setSelectedUserId("");
    setCustomRole("");
    setShowCustom(false);
    setOpen(false);
    await fetchMembers();
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm("Remover este membro do time?")) return;
    await supabase.from("team_members").delete().eq("id", id);
    toast.success("Membro removido");
    await fetchMembers();
  };

  const availableProfiles = allProfiles.filter(
    (p) => !members.find((m) => m.user_id === p.user_id)
  );

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Membros do Time
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os membros e perfis de acesso associados a este time
          </p>
        </div>

        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Adicionar Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Membro ao Time</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Usuário *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
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
        {sortedMembers.map((member) => {
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 -mr-1 -mt-1"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sortedMembers.length === 0 && !loading && (
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
