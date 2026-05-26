import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ShieldCheck, Save, Search, Trash2, AlertTriangle,
  ArrowRightLeft, Mail, KeyRound, Copy, CheckCircle2,
  Zap, Shield, BookOpen, UserCog, UserX, UserCheck, History,
} from "lucide-react";
import { getInitials, formatPersonName } from "@/lib/personName";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ModuleKey = "sala_agil" | "sustentacao" | "rdm";

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode; badgeClass: string }[] = [
  { key: "sala_agil",   label: "Sala Ágil",   icon: <Zap    className="h-3 w-3" />, badgeClass: "bg-violet-600/20 text-violet-400 border-violet-500/30" },
  { key: "sustentacao", label: "Sustentação", icon: <Shield  className="h-3 w-3" />, badgeClass: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
  { key: "rdm",         label: "RDM",         icon: <BookOpen className="h-3 w-3" />, badgeClass: "bg-purple-600/20 text-purple-400 border-purple-500/30" },
];

const PROFILES_BY_MODULE: Record<ModuleKey, { value: string; label: string }[]> = {
  sala_agil: [
    { value: "admin",          label: "Administrador" },
    { value: "scrum_master",   label: "Scrum Master" },
    { value: "product_owner",  label: "Product Owner" },
    { value: "developer",      label: "Desenvolvedor" },
    { value: "analyst",        label: "Analista de Requisitos" },
    { value: "architect",      label: "Arquiteto" },
    { value: "qa",             label: "Analista de QA" },
    { value: "member",         label: "Membro" },
  ],
  sustentacao: [
    { value: "admin",          label: "Administrador" },
    { value: "developer",      label: "Desenvolvedor" },
    { value: "analyst",        label: "Analista de Requisitos" },
    { value: "architect",      label: "Arquiteto" },
    { value: "qa",             label: "Analista de QA" },
    { value: "member",         label: "Membro" },
  ],
  rdm: [
    { value: "admin",           label: "Administrador" },
    { value: "change_manager",  label: "Gestor de Mudança" },
    { value: "rdm_approver",    label: "Aprovador RDM" },
    { value: "rdm_executor",    label: "Executor RDM" },
    { value: "member",          label: "Membro" },
  ],
};

// A coluna no banco se chama 'role_name', nao 'role'
interface ModuleAccess { module: ModuleKey; role: string; }

interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  module_access: string;
  is_active: boolean;
  must_change_password: boolean;
  teams: { id: string; name: string }[];
  moduleRoles: ModuleAccess[];
}

interface AuditEntry {
  id: string;
  actor_display_name: string;
  action: string;
  payload: Record<string, any>;
  created_at: string;
}

const DEMANDAS_TABLE = "demandas";
const DEMANDAS_USER_COLS = [
  "responsavel_requisitos", "responsavel_dev", "responsavel_teste",
  "responsavel_arquiteto", "aceite_responsavel", "demandante",
] as const;
const DEMANDA_RESPONSAVEIS_TABLE = "demanda_responsaveis";

interface DeleteState {
  user: UserRow | null;
  affectedCount: number;
  reassignToId: string;
  checking: boolean;
  deleting: boolean;
}
const DELETE_INITIAL: DeleteState = { user: null, affectedCount: 0, reassignToId: "", checking: false, deleting: false };

interface EmailState { user: UserRow | null; newEmail: string; saving: boolean; }
const EMAIL_INITIAL: EmailState = { user: null, newEmail: "", saving: false };

interface ResetState {
  user: UserRow | null;
  mode: "temp_password" | "send_link";
  saving: boolean;
  generatedPassword: string | null;
  recoveryLink: string | null;
}
const RESET_INITIAL: ResetState = { user: null, mode: "temp_password", saving: false, generatedPassword: null, recoveryLink: null };

interface ToggleActiveState { user: UserRow | null; saving: boolean; }
const TOGGLE_INITIAL: ToggleActiveState = { user: null, saving: false };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function legacyToModuleRoles(module_access: string): ModuleAccess[] {
  if (module_access === "admin") {
    return [
      { module: "sala_agil",   role: "admin" },
      { module: "sustentacao", role: "admin" },
    ];
  }
  if (module_access === "sala_agil")   return [{ module: "sala_agil",   role: "member" }];
  if (module_access === "sustentacao") return [{ module: "sustentacao", role: "member" }];
  return [];
}

function ModuleTags({ moduleRoles, module_access }: { moduleRoles: ModuleAccess[]; module_access: string }) {
  const effective = moduleRoles.length > 0 ? moduleRoles : legacyToModuleRoles(module_access);
  if (effective.length === 0) {
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">sem módulo</Badge>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {effective.map(({ module, role }) => {
        const mod = MODULES.find(m => m.key === module);
        if (!mod) return null;
        const roleLabel = PROFILES_BY_MODULE[module as ModuleKey]?.find(p => p.value === role)?.label ?? role;
        return (
          <Badge key={module} className={`text-[10px] gap-1 ${mod.badgeClass}`}>
            {mod.icon}{mod.label}: {roleLabel}
          </Badge>
        );
      })}
    </span>
  );
}

const ACTION_LABELS: Record<string, string> = {
  toggle_active:  "Status alterado",
  change_role:    "Perfil alterado",
  change_email:   "E-mail trocado",
  reset_password: "Senha resetada",
  delete_user:    "Usuário excluído",
};

function AuditLog({ userId }: { userId: string }) {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      // Busca log sem join em auth.users (PostgREST nao expoe FK para auth schema)
      // Em seguida busca display_name dos actors via profiles
      const { data, error } = await supabase
        .from("user_management_audit_log")
        .select("id, action, payload, created_at, actor_id")
        .eq("target_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;

      const rows = data || [];
      const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))];

      let actorNames: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", actorIds);
        (profiles || []).forEach((p: any) => {
          actorNames[p.user_id] = p.display_name ?? "Sistema";
        });
      }

      setEntries(
        rows.map((r: any) => ({
          id:                 r.id,
          actor_display_name: actorNames[r.actor_id] ?? "Sistema",
          action:             r.action,
          payload:            r.payload ?? {},
          created_at:         r.created_at,
        }))
      );
      setLoaded(true);
    } catch {
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="audit" className="border-0">
        <AccordionTrigger
          className="text-[11px] text-muted-foreground hover:no-underline py-1 gap-1"
          onClick={load}
        >
          <span className="flex items-center gap-1.5">
            <History className="h-3 w-3" /> Histórico de alterações
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {loading ? (
            <div className="flex justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {entries.map(e => (
                <li key={e.id} className="text-[11px] flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span>
                    <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
                    {" por "}
                    <span className="text-muted-foreground">{e.actor_display_name}</span>
                    {e.payload && Object.keys(e.payload).length > 0 && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {Object.entries(e.payload)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─── Helper de auditoria ────────────────────────────────────────────────────
async function writeAudit(
  actorId: string,
  targetId: string,
  action: string,
  payload: Record<string, any> = {}
) {
  try {
    await supabase.from("user_management_audit_log").insert({
      actor_id:  actorId,
      target_id: targetId,
      action,
      payload,
    });
  } catch {
    // Auditoria e best-effort — nao bloqueia a operacao principal
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export function UserRolesManager() {
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [editingUser, setEditingUser]   = useState<string | null>(null);
  const [pendingName, setPendingName]   = useState("");
  const [pendingModules, setPendingModules] = useState<Record<ModuleKey, { enabled: boolean; role: string }>>({} as any);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearch                 = useDebounce(searchFilter);
  const [deleteState, setDeleteState]   = useState<DeleteState>(DELETE_INITIAL);
  const [emailState, setEmailState]     = useState<EmailState>(EMAIL_INITIAL);
  const [resetState, setResetState]     = useState<ResetState>(RESET_INITIAL);
  const [toggleState, setToggleState]   = useState<ToggleActiveState>(TOGGLE_INITIAL);
  const [switchTarget, setSwitchTarget] = useState<UserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, umrRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email, module_access, is_active, must_change_password"),
        // Coluna correta e 'role_name', nao 'role'
        supabase.from("user_module_roles").select("user_id, module, role_name"),
        supabase.from("team_members").select("user_id, teams(id, name)"),
      ]);

      const profileList = (profilesRes.data || []) as any[];
      const umrList     = (umrRes.data     || []) as any[];
      const memberList  = (membersRes.data || []) as any[];

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
          teams:                teamsMap[p.user_id] || [],
          moduleRoles:          umrList
            .filter((r: any) => r.user_id === p.user_id)
            // Mapeia role_name -> role para manter compatibilidade com o restante do componente
            .map((r: any) => ({ module: r.module as ModuleKey, role: r.role_name })),
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

  function applyEditing(user: UserRow) {
    setEditingUser(user.user_id);
    setPendingName(user.display_name === "—" ? "" : user.display_name);
    const effective = user.moduleRoles.length > 0 ? user.moduleRoles : legacyToModuleRoles(user.module_access);
    const init = {} as Record<ModuleKey, { enabled: boolean; role: string }>;
    MODULES.forEach(({ key }) => {
      const found = effective.find(mr => mr.module === key);
      init[key] = { enabled: !!found, role: found?.role || PROFILES_BY_MODULE[key][0].value };
    });
    setPendingModules(init);
  }

  function requestEditing(user: UserRow) {
    if (editingUser && editingUser !== user.user_id) {
      setSwitchTarget(user);
    } else {
      applyEditing(user);
    }
  }

  function confirmSwitch() {
    if (!switchTarget) return;
    applyEditing(switchTarget);
    setSwitchTarget(null);
  }

  function cancelEditing() { setEditingUser(null); setPendingName(""); }

  function toggleModule(key: ModuleKey) {
    setPendingModules(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }

  function setModuleRole(key: ModuleKey, role: string) {
    setPendingModules(prev => ({
      ...prev,
      [key]: { ...prev[key], role },
    }));
  }

  async function saveUser(userId: string) {
    const currentUser = users.find(u => u.user_id === userId);
    if (!currentUser) return;
    const trimmedName = pendingName.trim();
    if (!trimmedName) { toast.error("O nome não pode estar vazio"); return; }

    const enabledModules = MODULES.filter(m => pendingModules[m.key]?.enabled);
    if (enabledModules.length === 0) { toast.error("Selecione pelo menos um módulo"); return; }

    setSaving(true);
    try {
      // Delete + insert usando a coluna CORRETA 'role_name'
      const { error: delErr } = await supabase
        .from("user_module_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from("user_module_roles")
        .insert(enabledModules.map(m => ({
          user_id:   userId,
          module:    m.key,
          role_name: pendingModules[m.key].role,  // 'role_name', nao 'role'
        })));
      if (insErr) throw insErr;

      let legacyModule = enabledModules[0].key as string;
      if (enabledModules.length > 1) legacyModule = "admin";

      const nameChanged = trimmedName !== currentUser.display_name;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          ...(nameChanged && { display_name: trimmedName }),
          module_access: legacyModule,
        })
        .eq("user_id", userId);
      if (profErr) throw profErr;

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, userId, "change_role", {
          modules: enabledModules.map(m => `${m.key}:${pendingModules[m.key].role}`).join(", "),
          ...(nameChanged && { nome: trimmedName }),
        });
      }

      toast.success("Perfil atualizado com sucesso!");
      setEditingUser(null); setPendingName("");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleActive() {
    const { user } = toggleState;
    if (!user) return;
    setToggleState(p => ({ ...p, saving: true }));
    const newActive = !user.is_active;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: newActive })
        .eq("user_id", user.user_id);
      if (error) throw error;

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, user.user_id, "toggle_active", {
          status: newActive ? "ativado" : "desativado",
        });
      }

      toast.success(
        newActive ? `${user.display_name} foi ativado.` : `${user.display_name} foi desativado.`
      );
      setToggleState(TOGGLE_INITIAL);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar status");
      setToggleState(p => ({ ...p, saving: false }));
    }
  }

  async function handleDeleteClick(user: UserRow) {
    setDeleteState({ ...DELETE_INITIAL, user, checking: true });
    try {
      const orFilter = DEMANDAS_USER_COLS.map(col => `${col}.eq.${user.user_id}`).join(",");
      const [directRes, relationalRes] = await Promise.all([
        supabase.from(DEMANDAS_TABLE).select("*", { count: "exact", head: true }).or(orFilter),
        supabase.from(DEMANDA_RESPONSAVEIS_TABLE).select("*", { count: "exact", head: true }).eq("user_id", user.user_id),
      ]);
      if (directRes.error) throw directRes.error;
      if (relationalRes.error) throw relationalRes.error;
      setDeleteState(prev => ({ ...prev, affectedCount: (directRes.count ?? 0) + (relationalRes.count ?? 0), checking: false }));
    } catch { toast.error("Erro ao verificar demandas"); setDeleteState(DELETE_INITIAL); }
  }

  async function confirmDelete() {
    const { user, affectedCount, reassignToId } = deleteState;
    if (!user) return;
    if (affectedCount > 0 && !reassignToId) { toast.error("Selecione um usuário para transferir as demandas"); return; }
    setDeleteState(prev => ({ ...prev, deleting: true }));
    try {
      if (affectedCount > 0 && reassignToId) {
        for (const col of DEMANDAS_USER_COLS) {
          await supabase.from(DEMANDAS_TABLE).update({ [col]: reassignToId }).eq(col, user.user_id);
        }
        const { data: relRows } = await supabase
          .from(DEMANDA_RESPONSAVEIS_TABLE)
          .select("id, demanda_id, papel")
          .eq("user_id", user.user_id);
        for (const row of relRows ?? []) {
          const { count } = await supabase
            .from(DEMANDA_RESPONSAVEIS_TABLE)
            .select("*", { count: "exact", head: true })
            .eq("demanda_id", row.demanda_id)
            .eq("user_id", reassignToId)
            .eq("papel", row.papel);
          if ((count ?? 0) > 0) {
            await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).delete().eq("id", row.id);
          } else {
            await supabase.from(DEMANDA_RESPONSAVEIS_TABLE).update({ user_id: reassignToId }).eq("id", row.id);
          }
        }
      }
      await supabase.from("user_module_roles").delete().eq("user_id", user.user_id);

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, user.user_id, "delete_user", {
          nome:  user.display_name,
          email: user.email,
          ...(reassignToId && { transferido_para: reassignToId }),
        });
      }

      const { error: fnError } = await supabase.functions.invoke("delete-user", { body: { user_id: user.user_id } });
      if (fnError) throw new Error(fnError.message);
      toast.success(affectedCount > 0
        ? `Usuário excluído e ${affectedCount} vínculo(s) transferido(s)!`
        : "Usuário excluído com sucesso!"
      );
      setDeleteState(DELETE_INITIAL);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir usuário");
      setDeleteState(prev => ({ ...prev, deleting: false }));
    }
  }

  const reassignOptions = useMemo(
    () => users.filter(u => u.user_id !== deleteState.user?.user_id),
    [users, deleteState.user]
  );

  async function submitChangeEmail() {
    const { user, newEmail } = emailState;
    if (!user) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { toast.error("E-mail inválido"); return; }
    if (trimmed === user.email.toLowerCase()) { toast.error("O novo e-mail é igual ao atual"); return; }
    setEmailState(p => ({ ...p, saving: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "change_email", user_id: user.user_id, new_email: trimmed, email_mode: "direct" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, user.user_id, "change_email", {
          email_anterior: user.email,
          email_novo:     trimmed,
        });
      }

      toast.success("E-mail trocado. O usuário deverá redefinir a senha no próximo login.");
      setEmailState(EMAIL_INITIAL);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao trocar e-mail");
      setEmailState(p => ({ ...p, saving: false }));
    }
  }

  async function submitResetPassword() {
    const { user, mode } = resetState;
    if (!user) return;
    setResetState(p => ({ ...p, saving: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "reset_password", user_id: user.user_id, mode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as any;

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, user.user_id, "reset_password", { modo: mode });
      }

      if (mode === "temp_password") {
        setResetState(p => ({ ...p, saving: false, generatedPassword: result.temp_password }));
        toast.success("Senha temporária gerada. Copie e repasse ao usuário.");
      } else {
        setResetState(p => ({ ...p, saving: false, recoveryLink: result.recovery_link ?? null }));
        toast.success("Link de redefinição enviado.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao redefinir senha");
      setResetState(p => ({ ...p, saving: false }));
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado!"),
      () => toast.error("Não foi possível copiar")
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Gestão de Perfis</h2>
          <p className="text-xs text-muted-foreground">Atribua perfis de acesso (RBAC) e módulo para cada usuário</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {totalItems} usuário{totalItems !== 1 ? "s" : ""} encontrado{totalItems !== 1 ? "s" : ""}
        {totalItems !== users.length && ` (de ${users.length} no sistema)`}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {paginatedItems.map(user => {
            const isEditing = editingUser === user.user_id;
            return (
              <Card
                key={user.user_id}
                className={[
                  !user.is_active ? "opacity-60 border-dashed" : "",
                  "transition-opacity",
                ].join(" ")}
              >
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                      {getInitials(user.display_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CardTitle className="text-sm font-semibold">{formatPersonName(user.display_name)}</CardTitle>
                        {!user.is_active && (
                          <Badge variant="outline" className="text-[9px] border-rose-400 text-rose-500">inativo</Badge>
                        )}
                        {user.must_change_password && (
                          <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-500">troca senha</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <ModuleTags moduleRoles={user.moduleRoles} module_access={user.module_access} />
                        {user.teams.map(t => (
                          <Badge key={t.id} variant="outline" className="text-[10px] font-normal">{t.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center shrink-0">
                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="text-xs" onClick={cancelEditing} disabled={saving}>Cancelar</Button>
                        <Button size="sm" onClick={() => saveUser(user.user_id)} disabled={saving}>
                          {saving
                            ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                            : <Save className="h-3.5 w-3.5 mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => requestEditing(user)}>
                          <UserCog className="h-3.5 w-3.5" /> Gerenciar Perfil
                        </Button>
                        <Button size="sm" variant="outline" title="Trocar e-mail"
                          onClick={() => setEmailState({ user, newEmail: user.email, saving: false })}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" title="Resetar senha"
                          onClick={() => setResetState({ ...RESET_INITIAL, user })}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title={user.is_active ? "Desativar usuário" : "Ativar usuário"}
                          className={user.is_active
                            ? "text-amber-600 hover:bg-amber-50 border-amber-300 dark:hover:bg-amber-950/30"
                            : "text-emerald-600 hover:bg-emerald-50 border-emerald-300 dark:hover:bg-emerald-950/30"
                          }
                          onClick={() => setToggleState({ user, saving: false })}
                        >
                          {user.is_active
                            ? <UserX    className="h-3.5 w-3.5" />
                            : <UserCheck className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => handleDeleteClick(user)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {isEditing && (
                  <CardContent className="pt-0">
                    <div className="space-y-5 mt-2">
                      <div className="max-w-xs">
                        <Label className="text-xs font-semibold">Nome de Exibição</Label>
                        <Input
                          value={pendingName}
                          onChange={e => setPendingName(e.target.value)}
                          placeholder="Nome do usuário"
                          className="h-8 mt-1 text-xs"
                          maxLength={80}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold">Módulos & Perfis</Label>
                        <div className="mt-2 space-y-3">
                          {MODULES.map(mod => {
                            const pm = pendingModules[mod.key];
                            const profiles = PROFILES_BY_MODULE[mod.key];
                            return (
                              <div key={mod.key} className="rounded-md border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge className={`text-[10px] gap-1 ${mod.badgeClass}`}>
                                    {mod.icon} {mod.label}
                                  </Badge>
                                  <Switch
                                    checked={pm?.enabled ?? false}
                                    onCheckedChange={() => toggleModule(mod.key)}
                                  />
                                </div>
                                {pm?.enabled && (
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Perfil em {mod.label}</Label>
                                    <Select value={pm.role} onValueChange={role => setModuleRole(mod.key, role)}>
                                      <SelectTrigger className="h-7 mt-1 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {profiles.map(p => (
                                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}

                <CardContent className="pt-0 pb-2">
                  <AuditLog userId={user.user_id} />
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

      <Dialog open={!!switchTarget} onOpenChange={open => { if (!open) setSwitchTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alterações não salvas
            </DialogTitle>
            <DialogDescription>
              Você está editando outro usuário. As alterações não salvas serão <strong>descartadas</strong>.
              Deseja continuar e editar{" "}
              <span className="font-semibold text-foreground">
                {switchTarget ? formatPersonName(switchTarget.display_name) : ""}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setSwitchTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={confirmSwitch}>Descartar e continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleState.user} onOpenChange={open => { if (!open && !toggleState.saving) setToggleState(TOGGLE_INITIAL); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {toggleState.user?.is_active
                ? <UserX     className="h-4 w-4 text-amber-500" />
                : <UserCheck className="h-4 w-4 text-emerald-500" />}
              {toggleState.user?.is_active ? "Desativar usuário" : "Ativar usuário"}
            </DialogTitle>
            <DialogDescription>
              {toggleState.user?.is_active ? (
                <>
                  <span className="font-semibold text-foreground">{toggleState.user?.display_name}</span> será{" "}
                  <strong>desativado</strong> e não conseguirá fazer login até ser reativado.
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{toggleState.user?.display_name}</span> será{" "}
                  <strong>reativado</strong> e poderá voltar a fazer login normalmente.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setToggleState(TOGGLE_INITIAL)} disabled={toggleState.saving}>Cancelar</Button>
            <Button
              size="sm"
              className={toggleState.user?.is_active
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
              onClick={confirmToggleActive}
              disabled={toggleState.saving}
            >
              {toggleState.saving
                ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                : toggleState.user?.is_active
                  ? <UserX    className="h-3.5 w-3.5 mr-1" />
                  : <UserCheck className="h-3.5 w-3.5 mr-1" />}
              {toggleState.user?.is_active ? "Desativar" : "Ativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteState.user} onOpenChange={open => { if (!open && !deleteState.deleting) setDeleteState(DELETE_INITIAL); }}>
        <DialogContent className="max-w-md">
          {deleteState.checking ? (
            <>
              <DialogHeader>
                <DialogTitle>Verificando vínculos</DialogTitle>
                <DialogDescription>Verificando demandas atribuídas ao usuário...</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            </>
          ) : deleteState.affectedCount > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <ArrowRightLeft className="h-4 w-4" /> Transferir demandas antes de excluir
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        O usuário <span className="font-semibold">{deleteState.user?.display_name}</span> possui{" "}
                        <span className="font-semibold">{deleteState.affectedCount} vínculo(s)</span> em demandas.
                        Selecione um novo responsável antes de excluir.
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Transferir responsabilidades para</Label>
                      <Select
                        value={deleteState.reassignToId}
                        onValueChange={v => setDeleteState(prev => ({ ...prev, reassignToId: v }))}
                      >
                        <SelectTrigger className="h-8 mt-1 text-xs">
                          <SelectValue placeholder="Selecione um usuário..." />
                        </SelectTrigger>
                        <SelectContent>
                          {reassignOptions.map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.display_name}{u.email ? ` — ${u.email}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setDeleteState(DELETE_INITIAL)} disabled={deleteState.deleting}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteState.deleting || !deleteState.reassignToId}>
                  {deleteState.deleting
                    ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                    : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Transferir e Excluir
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir usuário
                </DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir{" "}
                  <span className="font-semibold text-foreground">{deleteState.user?.display_name}</span>? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setDeleteState(DELETE_INITIAL)} disabled={deleteState.deleting}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteState.deleting}>
                  {deleteState.deleting
                    ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                    : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Confirmar Exclusão
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailState.user} onOpenChange={open => { if (!open && !emailState.saving) setEmailState(EMAIL_INITIAL); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Trocar e-mail do usuário
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  O e-mail será <strong>trocado imediatamente</strong>. Por segurança, o usuário será{" "}
                  <strong>obrigado a redefinir a senha</strong> no próximo login.
                </p>
                <div>
                  <Label className="text-xs font-semibold">E-mail atual</Label>
                  <Input value={emailState.user?.email ?? ""} disabled className="h-8 mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Novo e-mail *</Label>
                  <Input
                    type="email"
                    value={emailState.newEmail}
                    onChange={e => setEmailState(p => ({ ...p, newEmail: e.target.value }))}
                    placeholder="novo@email.com"
                    className="h-8 mt-1 text-xs"
                    autoFocus
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEmailState(EMAIL_INITIAL)} disabled={emailState.saving}>Cancelar</Button>
            <Button size="sm" onClick={submitChangeEmail} disabled={emailState.saving}>
              {emailState.saving
                ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                : <Mail className="h-3.5 w-3.5 mr-1" />}
              Trocar e-mail agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetState.user} onOpenChange={open => { if (!open && !resetState.saving) setResetState(RESET_INITIAL); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Resetar senha de {resetState.user?.display_name}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                {resetState.generatedPassword ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        Senha temporária gerada. <strong>Copie agora</strong> — ela não será exibida novamente.
                        O usuário será obrigado a definir uma nova senha no próximo login.
                      </p>
                    </div>
                    <Label className="text-xs font-semibold">Senha temporária</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={resetState.generatedPassword} className="h-9 font-mono text-sm" onFocus={e => e.currentTarget.select()} />
                      <Button size="sm" type="button" onClick={() => copyToClipboard(resetState.generatedPassword!)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : resetState.recoveryLink ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        Link de redefinição gerado. Caso o e-mail não chegue, repasse este link manualmente:
                      </p>
                    </div>
                    <Input readOnly value={resetState.recoveryLink} className="h-9 text-xs" onFocus={e => e.currentTarget.select()} />
                    <Button size="sm" type="button" onClick={() => copyToClipboard(resetState.recoveryLink!)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Escolha como deseja resetar a senha:</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "temp_password"}
                          onChange={() => setResetState(p => ({ ...p, mode: "temp_password" }))} className="mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold">Gerar senha temporária</p>
                          <p className="text-[11px] text-muted-foreground">Sistema gera uma senha forte exibida ao admin uma única vez. No próximo login, o usuário será forçado a trocá-la.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "send_link"}
                          onChange={() => setResetState(p => ({ ...p, mode: "send_link" }))} className="mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold">Enviar link de redefinição por e-mail</p>
                          <p className="text-[11px] text-muted-foreground">O usuário recebe um link no e-mail e define a própria senha.</p>
                        </div>
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
                {resetState.saving
                  ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                  : <KeyRound className="h-3.5 w-3.5 mr-1" />}
                Confirmar reset
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
