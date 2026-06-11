import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input }   from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { Switch }  from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label }   from "@/components/ui/label";
import { Zap, Shield, FileText, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import type { UserAdmin, UserModuleRole } from "../hooks/useUsersAdmin";
import type { TeamAdmin } from "../hooks/useTeamsAdmin";
import { fetchAllRoles } from "@/hooks/usePermissions";

// ── Módulos disponíveis ────────────────────────────────────────────────────
const MODULES = [
  { key: "sala_agil",   label: "Sala Ágil",   icon: Zap,      color: "text-blue-400" },
  { key: "sustentacao", label: "Sustentação", icon: Shield,   color: "text-emerald-400" },
  { key: "rdm",         label: "RDM",         icon: FileText, color: "text-purple-400" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

interface FormValues {
  display_name: string;
  email:        string;
  password:     string;
  team_id:      string;
}

interface Props {
  open:               boolean;
  user?:              UserAdmin | null;
  teams:              TeamAdmin[];
  isCurrentUserAdmin: boolean;
  onClose:            () => void;
  onCreate:           (data: FormValues & { module_roles: UserModuleRole[]; contract_role: "admin_contrato" | "member" }) => Promise<boolean>;
  onUpdate:           (userId: string, data: Partial<FormValues> & { module_roles: UserModuleRole[]; contract_role: "admin_contrato" | "member" }) => Promise<boolean>;
}

export function UserFormDialog({ open, user, teams, isCurrentUserAdmin, onClose, onCreate, onUpdate }: Props) {
  const isEdit = !!user;

  const form = useForm<FormValues>({
    defaultValues: { display_name: "", email: "", password: "", team_id: "none" },
  });

  const [moduleEnabled, setModuleEnabled] = useState<Record<ModuleKey, boolean>>({
    sala_agil: true, sustentacao: false, rdm: false,
  });
  const [moduleRole, setModuleRole] = useState<Record<ModuleKey, string>>({
    sala_agil: "member", sustentacao: "member", rdm: "member",
  });
  const [expandedModule,  setExpandedModule]  = useState<ModuleKey | null>("sala_agil");
  const [availableRoles,  setAvailableRoles]  = useState<{ name: string; label: string }[]>([]);
  const [isAdminContrato, setIsAdminContrato] = useState(false);

  useEffect(() => {
    fetchAllRoles().then(setAvailableRoles);
  }, []);

  useEffect(() => {
    if (!open) return;
    form.reset(
      isEdit
        ? { display_name: user!.display_name, email: user!.email, password: "", team_id: user!.team_id ?? "none" }
        : { display_name: "", email: "", password: "", team_id: "none" }
    );

    if (isEdit && user!.module_roles.length > 0) {
      const enabled: Record<ModuleKey, boolean> = { sala_agil: false, sustentacao: false, rdm: false };
      const roles:   Record<ModuleKey, string>  = { sala_agil: "member", sustentacao: "member", rdm: "member" };
      user!.module_roles.forEach(mr => {
        if (mr.module in enabled) {
          enabled[mr.module as ModuleKey] = true;
          roles[mr.module as ModuleKey]   = mr.role_name;
        }
      });
      setModuleEnabled(enabled);
      setModuleRole(roles);
      setExpandedModule(MODULES.find(m => enabled[m.key])?.key ?? null);
    } else {
      setModuleEnabled({ sala_agil: true, sustentacao: false, rdm: false });
      setModuleRole({ sala_agil: "member", sustentacao: "member", rdm: "member" });
      setExpandedModule("sala_agil");
    }

    setIsAdminContrato(isEdit ? user!.contract_role === "admin_contrato" : false);
  }, [open, user]);

  const buildModuleRoles = (): UserModuleRole[] =>
    MODULES
      .filter(m => moduleEnabled[m.key])
      .map(m => ({ module: m.key, role_name: moduleRole[m.key] }));

  const onSubmit = async (values: FormValues) => {
    const moduleRoles  = buildModuleRoles();
    const contractRole = isAdminContrato ? "admin_contrato" : "member";
    if (moduleRoles.length === 0) {
      form.setError("display_name", { message: "Ative pelo menos um módulo." });
      return;
    }
    const teamId = values.team_id === "none" ? null : values.team_id;
    let ok: boolean;
    if (isEdit) {
      ok = await onUpdate(user!.user_id, {
        display_name:  values.display_name,
        team_id:       teamId,
        module_roles:  moduleRoles,
        contract_role: contractRole,
      });
    } else {
      ok = await onCreate({ ...values, team_id: teamId, module_roles: moduleRoles, contract_role: contractRole });
    }
    if (ok) onClose();
  };

  const getRolesForModule = (moduleKey: ModuleKey) => {
    if (moduleKey === "rdm") {
      return availableRoles.filter(r =>
        ["rdm_gestor", "rdm_aprovador", "rdm_executor", "admin", "member"].includes(r.name)
      );
    }
    return availableRoles.filter(r =>
      !["rdm_gestor", "rdm_aprovador", "rdm_executor", "admin_contrato"].includes(r.name)
    );
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      {/* sm:max-w-xl = 576 px — muito mais espaço que o Dialog anterior */}
      <SheetContent side="right" className="sm:max-w-xl w-full flex flex-col gap-0 p-0">

        {/* Header fixo */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</SheetTitle>
        </SheetHeader>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Form {...form}>
            <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Nome */}
              <FormField control={form.control} name="display_name" rules={{ required: "Nome obrigatório" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de exibição</FormLabel>
                    <FormControl><Input placeholder="João Silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email e Senha — só na criação */}
              {!isEdit && (
                <>
                  <FormField control={form.control} name="email" rules={{ required: "E-mail obrigatório" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl><Input type="email" placeholder="joao@empresa.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="password"
                    rules={{ required: "Senha obrigatória", minLength: { value: 6, message: "Mínimo 6 caracteres" } }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha temporária</FormLabel>
                        <FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl>
                        <FormDescription className="text-[11px]">
                          O usuário será obrigado a trocar no primeiro acesso.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Time */}
              <FormField control={form.control} name="team_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time principal</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione um time" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem time</SelectItem>
                        {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Admin do Contrato — só visível para admin_master ─────── */}
              {isCurrentUserAdmin && (
                <div className={`rounded-lg border transition-colors ${
                  isAdminContrato
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-muted/20"
                }`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className={`h-4 w-4 ${
                        isAdminContrato ? "text-amber-400" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          isAdminContrato ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          Admin do Contrato
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Gerencia usuários, times e configurações do contrato
                        </p>
                      </div>
                      {isAdminContrato && (
                        <Badge variant="outline" className="text-[9px] ml-1 text-amber-400 border-amber-400/50">
                          admin_contrato
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={isAdminContrato}
                      onCheckedChange={setIsAdminContrato}
                      className="ml-3 scale-90"
                    />
                  </div>
                </div>
              )}

              {/* ── Módulos & Perfis ──────────────────────────────────────── */}
              <div className="space-y-2">
                <FormLabel className="text-sm font-semibold">Módulos & Perfis</FormLabel>
                <p className="text-[11px] text-muted-foreground">
                  Ative os módulos que este usuário pode acessar e escolha o perfil em cada um.
                </p>

                {MODULES.map(mod => {
                  const Icon   = mod.icon;
                  const isOn   = moduleEnabled[mod.key];
                  const isOpen = expandedModule === mod.key;
                  const roles  = getRolesForModule(mod.key);

                  return (
                    <div key={mod.key}
                      className={`rounded-lg border transition-colors ${
                        isOn ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => isOn && setExpandedModule(isOpen ? null : mod.key)}
                        >
                          <Icon className={`h-4 w-4 ${isOn ? mod.color : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${
                            isOn ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {mod.label}
                          </span>
                          {isOn && (
                            <Badge variant="outline" className={`text-[9px] ml-1 ${mod.color} border-current`}>
                              {availableRoles.find(r => r.name === moduleRole[mod.key])?.label ?? moduleRole[mod.key]}
                            </Badge>
                          )}
                          {isOn && (
                            isOpen
                              ? <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                          )}
                        </button>
                        <Switch
                          checked={isOn}
                          onCheckedChange={v => {
                            setModuleEnabled(prev => ({ ...prev, [mod.key]: v }));
                            if (v) setExpandedModule(mod.key);
                            else if (expandedModule === mod.key) setExpandedModule(null);
                          }}
                          className="ml-3 scale-90"
                        />
                      </div>

                      {isOn && isOpen && (
                        <div className="border-t border-border px-4 pb-4 pt-3">
                          {roles.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Carregando perfis...</p>
                          ) : (
                            <RadioGroup
                              value={moduleRole[mod.key]}
                              onValueChange={v => setModuleRole(prev => ({ ...prev, [mod.key]: v }))}
                              className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1"
                            >
                              {roles.map(r => (
                                <div key={r.name} className="flex items-center gap-2">
                                  <RadioGroupItem value={r.name} id={`${mod.key}-${r.name}`} />
                                  <Label htmlFor={`${mod.key}-${r.name}`} className="text-xs cursor-pointer">
                                    {r.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </form>
          </Form>
        </div>

        {/* Footer fixo na base */}
        <SheetFooter className="px-6 py-4 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            form="user-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
}
