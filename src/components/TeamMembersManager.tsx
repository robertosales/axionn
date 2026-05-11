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
import { Trash2, Users, UserPlus, Shield, Search } from "lucide-react";
import { getRoleLabel, type AppRole } from "@/hooks/usePermissions";

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
      toast.error("Selecione um usu\u00e1rio");
      return;
    }
    const exists = members.find((m) => m.user_id === selectedUserId);
    if (exists) {
      toast.error("Usu\u00e1rio j\u00e1 \u00e9 membro deste time");
      return;
    }
    const finalRole = showCustom ? customRole.trim() : memberRole;
    if (!finalRole) {
      toast.error("Informe a fun\u00e7\u00e3o do membro");
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
    if (!term) return true;
    return (
      m.profile?.display_name?.toLowerCase().includes(term) ||
      m.profile?.email?.toLowerCase().includes(term) ||
      m.role?.toLowerCase().includes(term)
    );
  });

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

      {/* ── TOPO: T\u00edtulo + Busca + Bot\u00e3o ── */}
      <div className="flex flex-col gap-3">
        {/* Linha 1: t\u00edtulo \u00e0 esquerda e bot\u00e3o \u00e0 direita */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Membros do Time
            </h2>
            <p className="text-sm text-muted-foreground">
              Gerencie os membros associados a este time
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
                    <Label>Usu\u00e1rio *</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usu\u00e1rio" />
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
                    <Label>Fun\u00e7\u00e3o no Time *</Label>
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
                              + Outra fun\u00e7\u00e3o...
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="Digite a fun\u00e7\u00e3o personalizada"
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

        {/* Linha 2: campo de busca ocupa largura total */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, e-mail ou fun\u00e7\u00e3o\u2026"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── INFORMA\u00c7\u00d5ES: total de membros abaixo da busca ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {search ? (
            <>
              <span className="font-semibold text-foreground">
                {filteredMembers.length}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-foreground">
                {members.length}
              </span>{" "}
              membros encontrados
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {members.length}
              </span>{" "}
              {members.length === 1 ? "membro" : "membros"} no time
            </>
          )}
        </span>
      </div>

      {/* ── GRID DE CARDS ── */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <Card key={member.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold">
                  {member.profile?.display_name || "Usu\u00e1rio"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {member.profile?.email}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {member.role}
                </Badge>
                {member.user_roles?.map((role) => (
                  <Badge key={role} variant="outline" className="text-[10px]">
                    <Shield className="h-3 w-3 mr-1" />
                    {getRoleLabel(role)}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Desde{" "}
                {new Date(member.joined_at).toLocaleDateString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── ESTADO VAZIO ── */}
      {filteredMembers.length === 0 && !loading && (
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
