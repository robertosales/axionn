import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ShieldCheck, Save, Search, Trash2, AlertTriangle,
  ArrowRightLeft, Mail, KeyRound, Copy, CheckCircle2, Zap, Shield,
} from "lucide-react";
import { fetchAllRoles, getRoleLabel, type AppRole } from "@/hooks/usePermissions";
import { getInitials, formatPersonName } from "@/lib/personName";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";

const DEMANDAS_TABLE = "demandas";
const DEMANDAS_USER_COLS = [
  "responsavel_requisitos", "responsavel_dev", "responsavel_teste",
  "responsavel_arquiteto", "aceite_responsavel", "demandante",
] as const;
const DEMANDA_RESPONSAVEIS_TABLE = "demanda_responsaveis";

interface UserWithRoles {
  user_id: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  module_access: string;
  is_active: boolean;
  must_change_password: boolean;
  teams: { id: string; name: string }[];
}

interface RoleOption { name: AppRole; label: string; }

interface DeleteState {
  user: UserWithRoles | null;
  affectedCount: number;
  reassignToId: string;
  checking: boolean;
  deleting: boolean;
}
const DELETE_INITIAL: DeleteState = { user: null, affectedCount: 0, reassignToId: "", checking: false, deleting: false };

interface EmailState { user: UserWithRoles | null; newEmail: string; saving: boolean; }
const EMAIL_INITIAL: EmailState = { user: null, newEmail: "", saving: false };

interface ResetState {
  user: UserWithRoles | null;
  mode: "temp_password" | "send_link";
  saving: boolean;
  generatedPassword: string | null;
  recoveryLink: string | null;
}
const RESET_INITIAL: ResetState = { user: null, mode: "temp_password", saving: false, generatedPassword: null, recoveryLink: null };

/** Retorna o label correto de módulo baseado no module_access E nos roles reais do usuário */
function getModuleLabel(module_access: string, roles: AppRole[]): string {
  const isAdmin = roles.includes("admin" as AppRole);
  if (module_access === "admin" && !isAdmin) return "Ambos";
  if (module_access === "admin" &&  isAdmin) return "Admin";
  if (module_access === "sala_agil")          return "Sala Ágil";
  if (module_access === "sustentacao")        return "Sustentação";
  return module_access;
}

function getModuleIcon(module_access: string, roles: AppRole[]) {
  const label = getModuleLabel(module_access, roles);
  if (label === "Sala Ágil")   return <Zap className="h-3 w-3" />;
  if (label === "Sustentação") return <Shield className="h-3 w-3" />;
  if (label === "Admin")       return <ShieldCheck className="h-3 w-3" />;
  return null;
}

export function UserRolesManagerEmbed() {
  const [users, setUsers]               = useState<UserWithRoles[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [editingUser, setEditingUser]   = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<AppRole[]>([]);
  const [pendingModule, setPendingModule] = useState<string>("sala_agil");
  const [pendingName, setPendingName]   = useState<string>("");
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearch                 = useDebounce(searchFilter);
  const [deleteState, setDeleteState]   = useState<DeleteState>(DELETE_INITIAL);
  const [emailState, setEmailState]     = useState<EmailState>(EMAIL_INITIAL);
  const [resetState, setResetState]     = useState<ResetState>(RESET_INITIAL);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, userRolesRes, rolesFromBank, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email, module_access, is_active, must_change_password"),
        supabase.from("user_roles").select("user_id, role"),
        fetchAllRoles(),
        supabase.from("team_members").select("user_id, teams(id, name)"),
      ]);

      const profileList  = (profilesRes.data  || []) as any[];
      const userRoleList = (userRolesRes.data || []) as any[];
      const memberList   = (membersRes.data   || []) as any[];

      setAvailableRoles(rolesFromBank.map((r) => ({ name: r.name as AppRole, label: r.label })));

      const teamsMap: Record<string, { id: string; name: string }[]> = {};
      memberList.forEach((m: any) => {
        if (!m.user_id || !m.teams) return;
        if (!teamsMap[m.user_id]) teamsMap[m.user_id] = [];
        const t = Array.isArray(m.teams) ? m.teams : [m.teams];
        t.forEach((team: any) => {
          if (team?.id && team?.name) teamsMap[m.user_id].push({ id: team.id, name: team.name });
        });
      });

      setUsers(
        profileList.map((p: any) => ({
          user_id:              p.user_id,
          display_name:         p.display_name || "—",
          email:                p.email || "",
          module_access:        p.module_access || "sala_agil",
          is_active:            p.is_active ?? true,
          must_change_password: p.must_change_password ?? false,
          roles:  userRoleList.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role as AppRole),
          teams:  teamsMap[p.user_id] || [],
        }))
      );
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, "pt-BR", { sensitivity: "base" })
    );
    if (!debouncedSearch) return sorted;
    const q = debouncedSearch.toLowerCase();
    return sorted.filter((u) =>
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.teams.some(t => t.name.toLowerCase().includes(q))
    );
  }, [users, debouncedSearch]);

  const { paginatedItems, currentPage, setCurrentPage, totalItems, pageSize } = usePagination(filteredUsers, { pageSize: 20 });

  function startEditing(user: UserWithRoles) {
    setEditingUser(user.user_id);
    setPendingRoles([...user.roles]);
    setPendingModule(user.module_access);
    setPendingName(user.display_name === "—" ? "" : user.display_name);
  }
  function cancelEditing() { setEditingUser(null); setPendingRoles([]); setPendingName(""); }
  function toggleRole(role: AppRole) {
    setPendingRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  async function saveRoles(userId: string) {
    const currentUser = users.find((u) => u.user_id === userId);
    if (!currentUser) return;
    const trimmedName = pendingName.trim();
    if (!trimmedName) { toast.error("O nome não pode estar vazio"); return; }
    setSaving(true);
    try {
      const toRemove = currentUser.roles.filter((r) => !pendingRoles.includes(r));
      const toAdd    = pendingRoles.filter((r) => !currentUser.roles.includes(r));
      for (const role of toRemove) await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      for (const role of toAdd)    await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      const nameChanged   = trimmedName !== currentUser.display_name && trimmedName !== "—";
      const moduleChanged = currentUser.module_access !== pendingModule;
      if (nameChanged || moduleChanged) {
        await supabase.from("profiles").update({
          ...(nameChanged   && { display_name:  trimmedName }),
          ...(moduleChanged && { module_access: pendingModule }),
        }).eq("user_id", userId);
      }
      toast.success("Perfis atualizados com sucesso!");
      setEditingUser(null); setPendingName("");
      await fetchUsers();
    } catch { toast.error("Erro ao salvar perfis"); }
    finally { setSaving(false); }
  }

  async function handleDeleteClick(user: UserWithRoles) {
    setDeleteState({ ...DELETE_INITIAL, user, checking: true });
    try {
      const orFilter = DEMANDAS_USER_COLS.map((col) => `${col}.eq.${user.user_id}`).join(",");
      const [directRes, relationalRes] = await Promise.all([
        supabase.from(DEMANDAS_TABLE).select("*", { count: "exact", head: true }).or(orFilter),
        supabase.from(DEMANDA_RESPONSAVEIS_TABLE).select("*", { count: "exact", head: true }).eq("user_id", user.user_id),
      ]);
      if (directRes.error) throw directRes.error;
      if (relationalRes.error) throw relationalRes.error;
      setDeleteState((prev) => ({ ...prev, affectedCount: (directRes.count ?? 0) + (relationalRes.count ?? 0), checking: false }));
    } catch { toast.error("Erro ao verificar demandas"); setDeleteState(DELETE_INITIAL); }
  }

  async function confirmDelete() {
    const { user, affectedCount, reassignToId } = deleteState;
    if (!user) return;
    if (affectedCount > 0 && !reassignToId) { toast.error("Selecione um usuário para transferir as demandas"); return; }
    setDeleteState((prev) => ({ ...prev, deleting: true }));
    try {
      if (affectedCount > 0 && reassignToId) {
        for (const col of DEMANDAS_USER_COLS) {
          const { error } = await supabase.from(DEMANDAS_TABLE).update({ [col]: reassignToId }).eq(col, user.user_id);
          if (error) throw new Error(`Erro ao transferir coluna ${col}: ${error.message}`);
        }
        const { data: relRows, error: fetchRelError } = await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).select("id, demanda_id, papel").eq("user_id", user.user_id);
        if (fetchRelError) throw new Error(fetchRelError.message);
        for (const row of relRows ?? []) {
          const { count } = await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).select("*", { count: "exact", head: true }).eq("demanda_id", row.demanda_id).eq("user_id", reassignToId).eq("papel", row.papel);
          if ((count ?? 0) > 0) {
            await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).delete().eq("id", row.id);
          } else {
            await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).update({ user_id: reassignToId }).eq("id", row.id);
          }
        }
      }
      await supabase.from("user_roles").delete().eq("user_id", user.user_id);
      const { error: fnError } = await supabase.functions.invoke("delete-user", { body: { user_id: user.user_id } });
      if (fnError) throw new Error(fnError.message);
      toast.success(affectedCount > 0 ? `Usuário excluído e ${affectedCount} vínculo(s) transferido(s)!` : "Usuário excluído com sucesso!");
      setDeleteState(DELETE_INITIAL);
      await fetchUsers();
    } catch (err: any) { toast.error(err?.message || "Erro ao excluir usuário"); setDeleteState((prev) => ({ ...prev, deleting: false })); }
  }

  const reassignOptions = useMemo(() => users.filter((u) => u.user_id !== deleteState.user?.user_id), [users, deleteState.user]);

  async function submitChangeEmail() {
    const { user, newEmail } = emailState;
    if (!user) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { toast.error("E-mail inválido"); return; }
    if (trimmed === user.email.toLowerCase()) { toast.error("O novo e-mail é igual ao atual"); return; }
    setEmailState((p) => ({ ...p, saving: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", { body: { action: "change_email", user_id: user.user_id, new_email: trimmed, email_mode: "direct" } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("E-mail trocado. O usuário deverá redefinir a senha no próximo login.");
      setEmailState(EMAIL_INITIAL); await fetchUsers();
    } catch (err: any) { toast.error(err?.message || "Erro ao trocar e-mail"); setEmailState((p) => ({ ...p, saving: false })); }
  }

  async function submitResetPassword() {
    const { user, mode } = resetState;
    if (!user) return;
    setResetState((p) => ({ ...p, saving: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", { body: { action: "reset_password", user_id: user.user_id, mode } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as any;
      if (mode === "temp_password") {
        setResetState((p) => ({ ...p, saving: false, generatedPassword: result.temp_password }));
        toast.success("Senha temporária gerada. Copie e repasse ao usuário.");
      } else {
        setResetState((p) => ({ ...p, saving: false, recoveryLink: result.recovery_link ?? null }));
        toast.success("Link de redefinição enviado.");
      }
    } catch (err: any) { toast.error(err?.message || "Erro ao redefinir senha"); setResetState((p) => ({ ...p, saving: false })); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado!"), () => toast.error("Não foi possível copiar"));
  }

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou time..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Total */}
      <p className="text-xs text-muted-foreground">{users.length} usuário{users.length !== 1 ? "s" : ""} no sistema</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {paginatedItems.map((user) => {
            const isEditing = editingUser === user.user_id;
            const moduleLabel = getModuleLabel(user.module_access, user.roles);
            const moduleIcon  = getModuleIcon(user.module_access, user.roles);
            return (
              <Card key={user.user_id} className={!user.is_active ? "opacity-50" : ""}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                      {getInitials(user.display_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-sm font-semibold">{formatPersonName(user.display_name)}</CardTitle>
                        {user.must_change_password && (
                          <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-500">troca senha</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {user.teams.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.teams.map(t => (
                            <Badge key={t.id} variant="outline" className="text-[10px] font-normal">{t.name}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center shrink-0">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {moduleIcon}{moduleLabel}
                    </Badge>
                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="text-xs" onClick={cancelEditing} disabled={saving}>Cancelar</Button>
                        <Button size="sm" onClick={() => saveRoles(user.user_id)} disabled={saving}>
                          {saving ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => startEditing(user)}>Editar</Button>
                        <Button size="sm" variant="outline" title="Trocar e-mail" onClick={() => setEmailState({ user, newEmail: user.email, saving: false })}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" title="Resetar senha" onClick={() => setResetState({ ...RESET_INITIAL, user })}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30" onClick={() => handleDeleteClick(user)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {isEditing ? (
                    <div className="space-y-4 mt-2">
                      <div className="max-w-xs">
                        <Label className="text-xs font-semibold">Nome de Exibição</Label>
                        <Input value={pendingName} onChange={(e) => setPendingName(e.target.value)} placeholder="Nome do usuário" className="h-8 mt-1 text-xs" maxLength={80} />
                      </div>
                      <div className="max-w-xs">
                        <Label className="text-xs font-semibold">Módulo de Acesso</Label>
                        <Select value={pendingModule} onValueChange={setPendingModule}>
                          <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sala_agil">⚡ Sala Ágil</SelectItem>
                            <SelectItem value="sustentacao">🛡 Sustentação</SelectItem>
                            <SelectItem value="admin">Ambos os módulos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Perfis (RBAC)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                          {availableRoles.map((r) => (
                            <label key={r.name} className="flex items-center gap-2 text-sm cursor-pointer group">
                              <Checkbox checked={pendingRoles.includes(r.name)} onCheckedChange={() => toggleRole(r.name)} />
                              <span className="group-hover:text-foreground transition-colors text-xs">{r.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {availableRoles.find((r) => r.name === role)?.label || getRoleLabel(role)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem perfil atribuído</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredUsers.length === 0 && !loading && (
        <Card className="border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhum usuário encontrado.</p>
        </Card>
      )}

      <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />

      {/* Modal: Excluir */}
      <Dialog open={!!deleteState.user} onOpenChange={(open) => { if (!open && !deleteState.deleting) setDeleteState(DELETE_INITIAL); }}>
        <DialogContent className="max-w-md">
          {deleteState.checking ? (
            <><DialogHeader><DialogTitle>Verificando vínculos</DialogTitle><DialogDescription>Verificando demandas atribuídas ao usuário...</DialogDescription></DialogHeader>
            <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div></>
          ) : deleteState.affectedCount > 0 ? (
            <><DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><ArrowRightLeft className="h-4 w-4" />Transferir demandas antes de excluir</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      O usuário <span className="font-semibold">{deleteState.user?.display_name}</span> possui{" "}
                      <span className="font-semibold">{deleteState.affectedCount} vínculo(s)</span> em demandas. Selecione um novo responsável antes de excluir.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Transferir responsabilidades para</Label>
                    <Select value={deleteState.reassignToId} onValueChange={(v) => setDeleteState((prev) => ({ ...prev, reassignToId: v }))}>
                      <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue placeholder="Selecione um usuário..." /></SelectTrigger>
                      <SelectContent>{reassignOptions.map((u) => (<SelectItem key={u.user_id} value={u.user_id}>{u.display_name}{u.email ? ` — ${u.email}` : ""}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteState(DELETE_INITIAL)} disabled={deleteState.deleting}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteState.deleting || !deleteState.reassignToId}>
                {deleteState.deleting ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Transferir e Excluir
              </Button>
            </DialogFooter></>
          ) : (
            <><DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" />Excluir usuário</DialogTitle>
              <DialogDescription>Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteState.user?.display_name}</span>? Esta ação não pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteState(DELETE_INITIAL)} disabled={deleteState.deleting}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteState.deleting}>
                {deleteState.deleting ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Confirmar Exclusão
              </Button>
            </DialogFooter></>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Trocar e-mail */}
      <Dialog open={!!emailState.user} onOpenChange={(open) => { if (!open && !emailState.saving) setEmailState(EMAIL_INITIAL); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Trocar e-mail do usuário</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">O e-mail será <strong>trocado imediatamente</strong>. Por segurança, o usuário será <strong>obrigado a redefinir a senha</strong> no próximo login.</p>
                <div><Label className="text-xs font-semibold">E-mail atual</Label><Input value={emailState.user?.email ?? ""} disabled className="h-8 mt-1 text-xs" /></div>
                <div>
                  <Label className="text-xs font-semibold">Novo e-mail *</Label>
                  <Input type="email" value={emailState.newEmail} onChange={(e) => setEmailState((p) => ({ ...p, newEmail: e.target.value }))} placeholder="novo@email.com" className="h-8 mt-1 text-xs" autoFocus />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEmailState(EMAIL_INITIAL)} disabled={emailState.saving}>Cancelar</Button>
            <Button size="sm" onClick={submitChangeEmail} disabled={emailState.saving}>
              {emailState.saving ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
              Trocar e-mail agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reset senha */}
      <Dialog open={!!resetState.user} onOpenChange={(open) => { if (!open && !resetState.saving) setResetState(RESET_INITIAL); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />Resetar senha de {resetState.user?.display_name}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                {resetState.generatedPassword ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">Senha temporária gerada. <strong>Copie agora</strong> — ela não será exibida novamente.</p>
                    </div>
                    <Label className="text-xs font-semibold">Senha temporária</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={resetState.generatedPassword} className="h-9 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
                      <Button size="sm" type="button" onClick={() => copyToClipboard(resetState.generatedPassword!)}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : resetState.recoveryLink ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">Link de redefinição gerado.</p>
                    </div>
                    <Input readOnly value={resetState.recoveryLink} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button size="sm" type="button" onClick={() => copyToClipboard(resetState.recoveryLink!)}><Copy className="h-3.5 w-3.5 mr-1" />Copiar link</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Escolha como deseja resetar a senha:</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "temp_password"} onChange={() => setResetState((p) => ({ ...p, mode: "temp_password" }))} className="mt-0.5" />
                        <div><p className="text-xs font-semibold">Gerar senha temporária</p><p className="text-[11px] text-muted-foreground">Sistema gera uma senha forte exibida ao admin uma única vez.</p></div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "send_link"} onChange={() => setResetState((p) => ({ ...p, mode: "send_link" }))} className="mt-0.5" />
                        <div><p className="text-xs font-semibold">Enviar link de redefinição por e-mail</p><p className="text-[11px] text-muted-foreground">O usuário recebe um link no e-mail e define a própria senha.</p></div>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setResetState(RESET_INITIAL)} disabled={resetState.saving}>
              {resetState.generatedPassword || resetState.recoveryLink ? "Fechar" : "Cancelar"}
            </Button>
            {!resetState.generatedPassword && !resetState.recoveryLink && (
              <Button size="sm" onClick={submitResetPassword} disabled={resetState.saving}>
                {resetState.saving ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <KeyRound className="h-3.5 w-3.5 mr-1" />}
                Confirmar reset
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
