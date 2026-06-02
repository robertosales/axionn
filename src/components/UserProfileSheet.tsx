/**
 * UserProfileSheet — Sheet lateral de gestao de perfil de usuario
 *
 * Abre a partir da lista de usuarios (UserRolesManager) ao clicar em '···' > Gerenciar Perfil.
 * Contem:
 *   - Header: avatar grande + nome + email + badges
 *   - Abas: Perfil & Modulos | Historico
 *   - Acoes Rapidas: trocar email, resetar senha, ativar/desativar
 *   - Footer fixo: Cancelar + Salvar Perfil
 *
 * STYLE GUIDE:
 *   Avatar header: h-12 w-12 rounded-full bg-primary/10 text-primary text-base font-bold
 *   Tab ativa: border-b-2 border-primary text-primary text-xs font-semibold
 *   Module card ativo: border-primary bg-primary/5
 *   Botoes acao: text-xs gap-1.5 h-8
 */
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter,
} from "@/components/ui/sheet";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Switch }   from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Save, Mail, KeyRound, UserX, UserCheck,
  Zap, Shield, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, formatPersonName } from "@/lib/personName";
import { AuditLogInline } from "./UserRolesManager";

// ─── Tipos (re-exportados para uso no UserRolesManager) ─────────────────────
export type ModuleKey = "sala_agil" | "sustentacao" | "rdm";

export const MODULES: {
  key: ModuleKey;
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
}[] = [
  {
    key: "sala_agil",
    label: "Sala Ágil",
    icon: <Zap className="h-2.5 w-2.5" />,
    badgeClass: "bg-violet-600/15 text-violet-700 border-violet-400/30 dark:text-violet-300",
  },
  {
    key: "sustentacao",
    label: "Sustentação",
    icon: <Shield className="h-2.5 w-2.5" />,
    badgeClass: "bg-blue-600/15 text-blue-700 border-blue-400/30 dark:text-blue-300",
  },
  {
    key: "rdm",
    label: "RDM",
    icon: <BookOpen className="h-2.5 w-2.5" />,
    badgeClass: "bg-purple-600/15 text-purple-700 border-purple-400/30 dark:text-purple-300",
  },
];

export const PROFILES_BY_MODULE: Record<ModuleKey, { value: string; label: string }[]> = {
  sala_agil: [
    { value: "admin",         label: "Administrador" },
    { value: "scrum_master",  label: "Scrum Master" },
    { value: "product_owner", label: "Product Owner" },
    { value: "developer",     label: "Desenvolvedor" },
    { value: "analyst",       label: "Analista de Requisitos" },
    { value: "architect",     label: "Arquiteto" },
    { value: "qa",            label: "Analista de QA" },
    { value: "member",        label: "Membro" },
  ],
  sustentacao: [
    { value: "admin",     label: "Administrador" },
    { value: "developer", label: "Desenvolvedor" },
    { value: "analyst",   label: "Analista de Requisitos" },
    { value: "architect", label: "Arquiteto" },
    { value: "qa",        label: "Analista de QA" },
    { value: "member",    label: "Membro" },
  ],
  rdm: [
    { value: "admin",          label: "Administrador" },
    { value: "change_manager", label: "Gestor de Mudança" },
    { value: "rdm_approver",   label: "Aprovador RDM" },
    { value: "rdm_executor",   label: "Executor RDM" },
    { value: "member",         label: "Membro" },
  ],
};

export interface ModuleAccess { module: ModuleKey; role: string; }

export interface UserRow {
  user_id:              string;
  display_name:         string;
  email:                string;
  module_access:        string;
  is_active:            boolean;
  must_change_password: boolean;
  teams:                { id: string; name: string }[];
  moduleRoles:          ModuleAccess[];
}

export interface PendingModules {
  [key: string]: { enabled: boolean; role: string };
}

interface Props {
  user:           UserRow | null;
  open:           boolean;
  pendingName:    string;
  pendingModules: PendingModules;
  saving:         boolean;
  onClose:        () => void;
  onSave:         () => void;
  onNameChange:   (v: string) => void;
  onToggleModule: (key: ModuleKey) => void;
  onRoleChange:   (key: ModuleKey, role: string) => void;
  onEmail:        () => void;
  onReset:        () => void;
  onToggleActive: () => void;
}

export function UserProfileSheet({
  user, open, pendingName, pendingModules, saving,
  onClose, onSave, onNameChange,
  onToggleModule, onRoleChange,
  onEmail, onReset, onToggleActive,
}: Props) {
  const [activeTab, setActiveTab] = useState<"perfil" | "historico">("perfil");

  if (!user) return null;

  const effectiveRoles = user.moduleRoles.length > 0
    ? user.moduleRoles
    : legacyToModuleRoles(user.module_access);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[420px] p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="p-5 pb-0 border-b border-border space-y-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-base">
              {getInitials(user.display_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold truncate">
                  {formatPersonName(user.display_name)}
                </p>
                {!user.is_active && (
                  <Badge variant="outline" className="text-[9px] border-rose-400 text-rose-500 py-0">inativo</Badge>
                )}
                {user.must_change_password && (
                  <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-500 py-0">troca senha</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {effectiveRoles.map(({ module, role }) => {
                  const mod = MODULES.find(m => m.key === module);
                  if (!mod) return null;
                  const roleLabel = PROFILES_BY_MODULE[module]?.find(p => p.value === role)?.label ?? role;
                  return (
                    <Badge key={module} className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
                      {mod.icon}{mod.label}: {roleLabel}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex">
            {(["perfil", "historico"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 text-xs font-medium border-b-2 transition-colors capitalize",
                  activeTab === tab
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "perfil" ? "Perfil & Módulos" : "Histórico"}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "perfil" ? (
            <>
              {/* Nome */}
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome de Exibição</Label>
                <Input
                  value={pendingName}
                  onChange={e => onNameChange(e.target.value)}
                  placeholder="Nome do usuário"
                  className="h-8 mt-1.5 text-xs"
                  maxLength={80}
                />
              </div>

              {/* Módulos */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Módulos &amp; Perfis</p>
                <div className="space-y-2">
                  {MODULES.map(mod => {
                    const pm = pendingModules[mod.key];
                    return (
                      <div
                        key={mod.key}
                        className={cn(
                          "rounded-lg border p-3 space-y-2 transition-colors",
                          pm?.enabled ? "border-primary/40 bg-primary/[.03]" : "border-border",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Badge className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
                            {mod.icon} {mod.label}
                          </Badge>
                          <Switch
                            checked={pm?.enabled ?? false}
                            onCheckedChange={() => onToggleModule(mod.key)}
                            className="scale-90"
                          />
                        </div>
                        {pm?.enabled && (
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Perfil em {mod.label}</Label>
                            <Select
                              value={pm.role}
                              onValueChange={role => onRoleChange(mod.key, role)}
                            >
                              <SelectTrigger className="h-7 mt-1 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROFILES_BY_MODULE[mod.key].map(p => (
                                  <SelectItem key={p.value} value={p.value} className="text-xs">
                                    {p.label}
                                  </SelectItem>
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

              {/* Times */}
              {user.teams.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Times</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.teams.map(t => (
                      <Badge key={t.id} variant="outline" className="text-[10px] font-normal">{t.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações rápidas */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ações Rápidas</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={onEmail}
                  >
                    <Mail className="h-3.5 w-3.5" /> Trocar e-mail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={onReset}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Resetar senha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "gap-1.5 text-xs h-8",
                      user.is_active
                        ? "text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        : "text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                    )}
                    onClick={onToggleActive}
                  >
                    {user.is_active
                      ? <><UserX className="h-3.5 w-3.5" /> Desativar</>        
                      : <><UserCheck className="h-3.5 w-3.5" /> Ativar</>}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Aba Histórico */
            <AuditLogInline userId={user.user_id} />
          )}
        </div>

        {/* ── Footer ── */}
        {activeTab === "perfil" && (
          <SheetFooter className="p-4 border-t border-border flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
              {saving
                ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                : <Save className="h-3.5 w-3.5" />}
              Salvar Perfil
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Helper legacy ────────────────────────────────────────────────────────────
export function legacyToModuleRoles(module_access: string): ModuleAccess[] {
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

// ─── ModuleTags (reutilizavel em outros contextos do sistema) ─────────────────
export function ModuleTags({
  moduleRoles,
  module_access,
}: {
  moduleRoles: ModuleAccess[];
  module_access: string;
}) {
  const effective = moduleRoles.length > 0 ? moduleRoles : legacyToModuleRoles(module_access);
  if (effective.length === 0) {
    return (
      <Badge variant="outline" className="text-[9px] text-muted-foreground">
        sem módulo
      </Badge>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {effective.map(({ module, role }) => {
        const mod = MODULES.find(m => m.key === module);
        if (!mod) return null;
        const roleLabel = PROFILES_BY_MODULE[module as ModuleKey]?.find(p => p.value === role)?.label ?? role;
        return (
          <Badge key={module} className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
            {mod.icon}{mod.label}: {roleLabel}
          </Badge>
        );
      })}
    </span>
  );
}
