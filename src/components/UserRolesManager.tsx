/**
 * UserRolesManager — Gestao de perfis e acesso RBAC
 *
 * Redesign completo:
 * - Lista compacta em tabela (substituiu Cards)
 * - Sheet lateral (UserProfileSheet) para edicao
 * - DropdownMenu unico por linha (substituiu 5 botoes soltos)
 * - Todos os Dialogs de confirmacao preservados
 *
 * STYLE GUIDE:
 *   Header tabela: bg-muted/60 text-[10px] uppercase tracking-wider py-2
 *   Linha: text-xs py-2 hover:bg-muted/30
 *   Avatar: h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold
 *   Badge modulo: text-[9px] px-1.5 py-0
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Switch }  from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent,
  AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, MoreHorizontal, UserCog, Mail, KeyRound,
  UserX, UserCheck, ArrowRightLeft, AlertTriangle,
  Copy, CheckCircle2, Save, History, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, formatPersonName } from "@/lib/personName";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination }      from "@/shared/hooks/usePagination";
import { useDebounce }        from "@/shared/hooks/useDebounce";
import {
  UserProfileSheet,
  ModuleTags,
  legacyToModuleRoles,
  MODULES,
  PROFILES_BY_MODULE,
  type ModuleKey,
  type ModuleAccess,
  type UserRow,
  type PendingModules,
} from "./UserProfileSheet";

// ─── AuditLog exportado para uso no Sheet ────────────────────────────────────

interface AuditEntry {
  id: string;
  actor_display_name: string;
  action: string;
  payload: Record<string, any>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  toggle_active:  "Status alterado",
  change_role:    "Perfil alterado",
  change_email:   "E-mail trocado",
  reset_password: "Senha resetada",
  delete_user:    "Usuário excluído",
};

export function AuditLogInline({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_management_audit_log")
          .select("id, action, payload, created_at, actor_id")
          .eq("target_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;

        const rows = data || [];
        const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))];
        const actorNames: Record<string, string> = {};
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", actorIds);
          (profiles || []).forEach((p: any) => {
            actorNames[p.user_id] = p.display_name ?? "Sistema";
          });
        }
        setEntries(rows.map((r: any) => ({
          id:                 r.id,
          actor_display_name: actorNames[r.actor_id] ?? "Sistema",
          action:             r.action,
          payload:            r.payload ?? {},
          created_at:         r.created_at,
        })));
        setLoaded(true);
      } catch {
        toast.error("Erro ao carregar histórico");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, loaded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">Nenhuma alteração registrada.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {entries.map(e => (
        <li key={e.id} className="text-[11px] flex items-start gap-2 border-b border-border pb-2 last:border-0">
          <span className="text-muted-foreground shrink-0 tabular-nums text-[10px]">
            {new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </span>
          <span>
            <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
            {" por "}
            <span className="text-muted-foreground">{e.actor_display_name}</span>
            {e.payload && Object.keys(e.payload).length > 0 && (
              <span className="text-muted-foreground">
                {" — "}
                {Object.entries(e.payload).map(([k, v]) => `${k}: ${v}`).join(", ")}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Helpers de auditoria ─────────────────────────────────────────────────────
async function writeAudit(
  actorId: string,
  targetId: string,
  action: string,
  payload: Record<string, any> = {},
) {
  try {
    await supabase.from("user_management_audit_log").insert({
      actor_id:  actorId,
      target_id: targetId,
      action,
      payload,
    });
  } catch { /* best-effort */ }
}

// ─── Estados auxiliares ───────────────────────────────────────────────────────
const DEMANDAS_TABLE       = "demandas";
const DEMANDAS_USER_COLS   = [
  "responsavel_requisitos", "responsavel_dev", "responsavel_teste",
  "responsavel_arquiteto",  "aceite_responsavel", "demandante",
] as const;
const DEMANDA_RESPONSAVEIS = "demanda_responsaveis";

interface DeleteState {
  user: UserRow | null;
  affectedCount: number;
  reassignToId: string;
  checking: boolean;
  deleting: boolean;
}
const DEL0: DeleteState = { user: null, affectedCount: 0, reassignToId: "", checking: false, deleting: false };

interface EmailState  { user: UserRow | null; newEmail: string; saving: boolean; }
const EMAIL0: EmailState = { user: null, newEmail: "", saving: false };

interface ResetState {
  user: UserRow | null;
  mode: "temp_password" | "send_link";
  saving: boolean;
  generatedPassword: string | null;
  recoveryLink: string | null;
}
const RESET0: ResetState = { user: null, mode: "temp_password", saving: false, generatedPassword: null, recoveryLink: null };

interface ToggleState { user: UserRow | null; saving: boolean; }
const TOG0: ToggleState = { user: null, saving: false };

// ─── Componente principal ─────────────────────────────────────────────────────

export function UserRolesManager() {
  const [users,         setUsers]         = useState<UserRow[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [searchFilter,  setSearchFilter]  = useState("");
  const debouncedSearch = useDebounce(searchFilter);

  // Sheet
  const [sheetUser,       setSheetUser]       = useState<UserRow | null>(null);
  const [pendingName,     setPendingName]     = useState("");
  const [pendingModules,  setPendingModules]  = useState<PendingModules>({} as any);
  const [saving,          setSaving]          = useState(false);

  // Dialogs
  const [inactivateState, setInactivateState] = useState<DeleteState>(DEL0);
  const [emailState,      setEmailState]      = useState<EmailState>(EMAIL0);
  const [resetState,      setResetState]      = useState<ResetState>(RESET0);
  const [toggleState,     setToggleState]     = useState<ToggleState>(TOG0);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, umrRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email, module_access, is_active, must_change_password"),
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

  // ── Filtro + paginação ──────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, "pt-BR", { sensitivity: "base" })
    );
    if (!debouncedSearch) return sorted;
    const q = debouncedSearch.toLowerCase();
    return sorted.filter(u =>
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.teams.some(t => t.name.toLowerCase().includes(q))
    );
  }, [users, debouncedSearch]);

  const { paginatedItems, currentPage, setCurrentPage, totalItems, pageSize } =
    usePagination(filteredUsers, { pageSize: 30 });

  // ── Abrir Sheet ─────────────────────────────────────────────────────────────
  function openSheet(user: UserRow) {
    const effective = user.moduleRoles.length > 0
      ? user.moduleRoles
      : legacyToModuleRoles(user.module_access);
    const init = {} as PendingModules;
    MODULES.forEach(({ key }) => {
      const found = effective.find(mr => mr.module === key);
      init[key] = { enabled: !!found, role: found?.role || PROFILES_BY_MODULE[key][0].value };
    });
    setPendingName(user.display_name === "—" ? "" : user.display_name);
    setPendingModules(init);
    setSheetUser(user);
  }

  function closeSheet() { setSheetUser(null); setPendingName(""); }

  function toggleModule(key: ModuleKey) {
    setPendingModules(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }

  function setModuleRole(key: ModuleKey, role: string) {
    setPendingModules(prev => ({ ...prev, [key]: { ...prev[key], role } }));
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────
  async function saveUser() {
    const user = sheetUser;
    if (!user) return;
    const trimmed = pendingName.trim();
    if (!trimmed) { toast.error("O nome não pode estar vazio"); return; }
    const enabled = MODULES.filter(m => pendingModules[m.key]?.enabled);
    if (enabled.length === 0) { toast.error("Selecione pelo menos um módulo"); return; }

    setSaving(true);
    try {
      const { error: delErr } = await supabase.from("user_module_roles").delete().eq("user_id", user.user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_module_roles").insert(
        enabled.map(m => ({ user_id: user.user_id, module: m.key, role_name: pendingModules[m.key].role }))
      );
      if (insErr) throw insErr;

      let legacy = enabled[0].key as string;
      if (enabled.length > 1) legacy = "admin";
      const nameChanged = trimmed !== user.display_name;
      const { error: profErr } = await supabase.from("profiles").update({
        ...(nameChanged && { display_name: trimmed }),
        module_access: legacy,
      }).eq("user_id", user.user_id);
      if (profErr) throw profErr;

      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit(actor.id, user.user_id, "change_role", {
          modules: enabled.map(m => `${m.key}:${pendingModules[m.key].role}`).join(", "),
          ...(nameChanged && { nome: trimmed }),
        });
      }
      toast.success("Perfil atualizado!");
      closeSheet();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle ativo ──────────────────────────────────────────────────────────
  async function confirmToggleActive() {
    const { user } = toggleState;
    if (!user) return;
    setToggleState(p => ({ ...p, saving: true }));
    const newActive = !user.is_active;
    try {
      const { error } = await supabase.from("profiles").update({ is_active: newActive }).eq("user_id", user.user_id);
      if (error) throw error;
      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) await writeAudit(actor.id, user.user_id, "toggle_active", { status: newActive ? "ativado" : "desativado" });
      toast.success(newActive ? `${user.display_name} ativado.` : `${user.display_name} desativado.`);
      setToggleState(TOG0);
      // Fecha sheet se estava aberto para o mesmo usuario
      if (sheetUser?.user_id === user.user_id) closeSheet();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar status");
      setToggleState(p => ({ ...p, saving: false }));
    }
  }

  // ── Inativar + migrar ─────────────────────────────────────────────────────
  async function handleInactivateClick(user: UserRow) {
    setInactivateState({ ...DEL0, user, checking: true });
    try {
      const orFilter = DEMANDAS_USER_COLS.map(col => `${col}.eq.${user.user_id}`).join(",");
      const [a, b, c, d] = await Promise.all([
        supabase.from(DEMANDAS_TABLE).select("*", { count: "exact", head: true }).or(orFilter),
        supabase.from(DEMANDA_RESPONSAVEIS).select("*", { count: "exact", head: true }).eq("user_id", user.user_id),
        supabase.from("user_stories").select("*", { count: "exact", head: true }).eq("assignee_id", user.user_id),
        supabase.from("activities").select("*", { count: "exact", head: true }).eq("assignee_id", user.user_id),
      ]);
      const count = (a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0) + (d.count ?? 0);
      setInactivateState(prev => ({ ...prev, affectedCount: count, checking: false }));
    } catch {
      toast.error("Erro ao verificar vínculos");
      setInactivateState(DEL0);
    }
  }

  async function confirmInactivate() {
    const { user, reassignToId } = inactivateState;
    if (!user || !reassignToId) { toast.error("Selecione um sucessor"); return; }
    setInactivateState(p => ({ ...p, deleting: true }));
    try {
      const [{ data: succP }, { data: targP }] = await Promise.all([
        supabase.from("profiles").select("id").eq("user_id", reassignToId).single(),
        supabase.from("profiles").select("id").eq("user_id", user.user_id).single(),
      ]);
      if (!succP || !targP) throw new Error("Erro ao identificar perfis.");
      const { error } = await supabase.rpc("fn_inactivate_user_with_migration", {
        p_target_profile_id:    targP.id,
        p_successor_profile_id: succP.id,
      });
      if (error) throw error;
      toast.success(`${user.display_name} inativado e tarefas transferidas!`);
      setInactivateState(DEL0);
      if (sheetUser?.user_id === user.user_id) closeSheet();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao inativar usuário");
      setInactivateState(p => ({ ...p, deleting: false }));
    }
  }

  const reassignOptions = useMemo(
    () => users.filter(u => u.user_id !== inactivateState.user?.user_id && u.is_active),
    [users, inactivateState.user]
  );

  // ── Trocar e-mail ─────────────────────────────────────────────────────────
  async function submitChangeEmail() {
    const { user, newEmail } = emailState;
    if (!user) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { toast.error("E-mail inválido"); return; }
    if (trimmed === user.email.toLowerCase()) { toast.error("E-mail igual ao atual"); return; }
    setEmailState(p => ({ ...p, saving: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "change_email", user_id: user.user_id, new_email: trimmed, email_mode: "direct" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) await writeAudit(actor.id, user.user_id, "change_email", { email_anterior: user.email, email_novo: trimmed });
      toast.success("E-mail trocado!");
      setEmailState(EMAIL0);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao trocar e-mail");
      setEmailState(p => ({ ...p, saving: false }));
    }
  }

  // ── Resetar senha ─────────────────────────────────────────────────────────
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
      if (actor) await writeAudit(actor.id, user.user_id, "reset_password", { modo: mode });
      if (mode === "temp_password") {
        setResetState(p => ({ ...p, saving: false, generatedPassword: result.temp_password }));
        toast.success("Senha temporária gerada.");
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
      () => toast.error("Não foi possível copiar"),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Busca + contador */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {totalItems} usuário{totalItems !== 1 ? "s" : ""} encontrado{totalItems !== 1 ? "s" : ""}
          {totalItems !== users.length && ` (de ${users.length})`}
        </span>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Usuário</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Módulo &amp; Perfil</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Times</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Status</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-10">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : paginatedItems.map(user => (
                <TableRow
                  key={user.user_id}
                  className={cn(
                    "transition-colors",
                    !user.is_active && "opacity-60",
                  )}
                >
                  {/* Usuário */}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">
                        {getInitials(user.display_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">{formatPersonName(user.display_name)}</p>
                          {!user.is_active && (
                            <Badge variant="outline" className="text-[8px] border-rose-400 text-rose-500 py-0 px-1 shrink-0">inativo</Badge>
                          )}
                          {user.must_change_password && (
                            <Badge variant="outline" className="text-[8px] border-orange-400 text-orange-500 py-0 px-1 shrink-0">↻ senha</Badge>
                          )}
                        </div>
                        <p className="text-[10.5px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Módulo */}
                  <TableCell className="py-2">
                    <ModuleTags moduleRoles={user.moduleRoles} module_access={user.module_access} />
                  </TableCell>

                  {/* Times */}
                  <TableCell className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {user.teams.length > 0
                        ? user.teams.map(t => (
                            <Badge key={t.id} variant="outline" className="text-[9px] font-normal px-1.5 py-0">{t.name}</Badge>
                          ))
                        : <span className="text-[10.5px] text-muted-foreground">—</span>}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2 text-center">
                    {user.is_active
                      ? <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0 dark:bg-emerald-900/30 dark:text-emerald-400">● ativo</Badge>
                      : <Badge className="text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0 dark:bg-rose-900/30 dark:text-rose-400">● inativo</Badge>}
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => openSheet(user)}>
                          <UserCog className="h-3.5 w-3.5" /> Gerenciar Perfil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => setEmailState({ user, newEmail: user.email, saving: false })}>
                          <Mail className="h-3.5 w-3.5" /> Trocar e-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => setResetState({ ...RESET0, user })}>
                          <KeyRound className="h-3.5 w-3.5" /> Resetar senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className={cn(
                            "gap-2 text-xs",
                            user.is_active
                              ? "text-amber-600 focus:text-amber-600"
                              : "text-emerald-600 focus:text-emerald-600",
                          )}
                          onClick={() => setToggleState({ user, saving: false })}
                        >
                          {user.is_active
                            ? <><UserX className="h-3.5 w-3.5" /> Desativar</>
                            : <><UserCheck className="h-3.5 w-3.5" /> Ativar</>}
                        </DropdownMenuItem>
                        {user.is_active && (
                          <DropdownMenuItem
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                            onClick={() => handleInactivateClick(user)}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Inativar &amp; Migrar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Sheet lateral de perfil */}
      <UserProfileSheet
        user={sheetUser}
        open={!!sheetUser}
        pendingName={pendingName}
        pendingModules={pendingModules}
        saving={saving}
        onClose={closeSheet}
        onSave={saveUser}
        onNameChange={setPendingName}
        onToggleModule={toggleModule}
        onRoleChange={setModuleRole}
        onEmail={() => {
          if (!sheetUser) return;
          setEmailState({ user: sheetUser, newEmail: sheetUser.email, saving: false });
        }}
        onReset={() => {
          if (!sheetUser) return;
          setResetState({ ...RESET0, user: sheetUser });
        }}
        onToggleActive={() => {
          if (!sheetUser) return;
          setToggleState({ user: sheetUser, saving: false });
        }}
      />

      {/* Dialog — Toggle ativo */}
      <Dialog open={!!toggleState.user} onOpenChange={v => { if (!v && !toggleState.saving) setToggleState(TOG0); }}>
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
                <><span className="font-semibold text-foreground">{toggleState.user?.display_name}</span> será <strong>desativado</strong> e não conseguirá fazer login até ser reativado.</>
              ) : (
                <><span className="font-semibold text-foreground">{toggleState.user?.display_name}</span> será <strong>reativado</strong> e poderá voltar a fazer login normalmente.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setToggleState(TOG0)} disabled={toggleState.saving}>Cancelar</Button>
            <Button
              size="sm"
              className={toggleState.user?.is_active ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
              onClick={confirmToggleActive}
              disabled={toggleState.saving}
            >
              {toggleState.saving
                ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                : toggleState.user?.is_active ? <UserX className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
              {toggleState.user?.is_active ? "Desativar" : "Ativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Inativar + Migrar */}
      <Dialog open={!!inactivateState.user} onOpenChange={v => { if (!v && !inactivateState.deleting) setInactivateState(DEL0); }}>
        <DialogContent className="max-w-md">
          {inactivateState.checking ? (
            <>
              <DialogHeader>
                <DialogTitle>Verificando vínculos</DialogTitle>
                <DialogDescription>Buscando atividades, demandas e RDMs atribuídos...</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <UserX className="h-4 w-4" /> Inativar e Migrar Usuário
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-semibold">{inactivateState.user?.display_name}</span> será inativado.
                        {inactivateState.affectedCount > 0
                          ? <> Possui <strong>{inactivateState.affectedCount} vínculo(s)</strong> que devem ser transferidos.</>
                          : <> Selecione um sucessor para manter o histórico íntegro.</>}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Transferir para (Sucessor)</Label>
                      <Select value={inactivateState.reassignToId} onValueChange={v => setInactivateState(p => ({ ...p, reassignToId: v }))}>
                        <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue placeholder="Selecione um sucessor ativo..." /></SelectTrigger>
                        <SelectContent>
                          {reassignOptions.map(u => (
                            <SelectItem key={u.user_id} value={u.user_id} className="text-xs">{u.display_name} ({u.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setInactivateState(DEL0)} disabled={inactivateState.deleting}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={confirmInactivate} disabled={inactivateState.deleting || !inactivateState.reassignToId}>
                  {inactivateState.deleting ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />}
                  Migrar e Inativar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog — Trocar e-mail */}
      <Dialog open={!!emailState.user} onOpenChange={v => { if (!v && !emailState.saving) setEmailState(EMAIL0); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Trocar e-mail</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">O e-mail será <strong>trocado imediatamente</strong>. O usuário será <strong>obrigado a redefinir a senha</strong> no próximo login.</p>
                <div>
                  <Label className="text-xs font-semibold">E-mail atual</Label>
                  <Input value={emailState.user?.email ?? ""} disabled className="h-8 mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Novo e-mail *</Label>
                  <Input type="email" value={emailState.newEmail} onChange={e => setEmailState(p => ({ ...p, newEmail: e.target.value }))} placeholder="novo@email.com" className="h-8 mt-1 text-xs" autoFocus />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEmailState(EMAIL0)} disabled={emailState.saving}>Cancelar</Button>
            <Button size="sm" onClick={submitChangeEmail} disabled={emailState.saving}>
              {emailState.saving ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
              Trocar e-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Resetar senha */}
      <Dialog open={!!resetState.user} onOpenChange={v => { if (!v && !resetState.saving) setResetState(RESET0); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Resetar senha de {resetState.user?.display_name}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                {resetState.generatedPassword ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">Senha temporária gerada. <strong>Copie agora</strong> — não será exibida novamente.</p>
                    </div>
                    <Label className="text-xs font-semibold">Senha temporária</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={resetState.generatedPassword} className="h-9 font-mono text-sm" onFocus={e => e.currentTarget.select()} />
                      <Button size="sm" onClick={() => copyToClipboard(resetState.generatedPassword!)}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : resetState.recoveryLink ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">Link de redefinição gerado. Caso o e-mail não chegue, repasse manualmente:</p>
                    </div>
                    <Input readOnly value={resetState.recoveryLink} className="h-9 text-xs" onFocus={e => e.currentTarget.select()} />
                    <Button size="sm" onClick={() => copyToClipboard(resetState.recoveryLink!)}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar link</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Escolha como deseja resetar a senha:</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "temp_password"} onChange={() => setResetState(p => ({ ...p, mode: "temp_password" }))} className="mt-0.5" />
                        <div><p className="text-xs font-semibold">Gerar senha temporária</p><p className="text-[11px] text-muted-foreground">Sistema gera uma senha forte exibida ao admin uma única vez.</p></div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <input type="radio" name="reset-mode" checked={resetState.mode === "send_link"} onChange={() => setResetState(p => ({ ...p, mode: "send_link" }))} className="mt-0.5" />
                        <div><p className="text-xs font-semibold">Enviar link por e-mail</p><p className="text-[11px] text-muted-foreground">O usuário recebe um link e define a própria senha.</p></div>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setResetState(RESET0)} disabled={resetState.saving}>
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
