import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronsUpDown, Eye, KeyRound, RotateCcw, ShieldAlert, UserRoundSearch } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRbacAccessSimulator } from "@/features/rbac/hooks/useRbacAccessSimulator";
import { getRbacGroupLabel, RBAC_MODULES } from "@/features/rbac/rbacCatalog";
import type { RbacMemberOption, RbacSimulatedModuleProfile } from "@/features/rbac/types";

export function RbacAccessSimulator() {
  const {
    members,
    membersLoading,
    membersError,
    reloadMembers,
    simulation,
    simulationLoading,
    simulationError,
    simulate,
    resetSimulation,
  } = useRbacAccessSimulator();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedMember = members.find((member) => member.userId === selectedUserId) ?? null;

  if (membersLoading) return <SimulatorSkeleton />;

  if (membersError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível preparar o simulador</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{membersError}</span>
          <Button variant="outline" className="h-11" onClick={() => void reloadMembers()}><RotateCcw className="mr-2 h-4 w-4" />Tentar novamente</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Eye className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="text-lg font-semibold">Simular acesso de um usuário</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Visualize os perfis e permissões efetivos sem alterar nenhuma atribuição.</p></div>
          </div>

          {members.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-6 text-center">
              <UserRoundSearch className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">Nenhum membro disponível</p>
              <p className="mt-1 text-sm text-muted-foreground">Adicione pessoas à organização antes de simular acessos.</p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <MemberPicker
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  members={members}
                  selected={selectedMember}
                  onSelect={(userId) => {
                    setSelectedUserId(userId);
                    resetSimulation();
                  }}
                />
              </div>
              <Button className="h-11 md:min-w-40" disabled={!selectedUserId || simulationLoading} onClick={() => void simulate(selectedUserId)}>
                {simulationLoading ? <RotateCcw className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Eye className="mr-2 h-4 w-4" />}
                {simulationLoading ? "Simulando..." : "Simular acesso"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {simulationError && (
        <Alert variant="destructive" role="alert"><AlertTriangle className="h-4 w-4" /><AlertTitle>Falha na simulação</AlertTitle><AlertDescription>{simulationError}</AlertDescription></Alert>
      )}

      {simulationLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Simulando acesso"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      ) : simulation ? (
        <SimulationResult simulation={simulation} />
      ) : members.length > 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <UserRoundSearch className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">Escolha quem deseja visualizar</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">O resultado agrupa permissões por módulo e perfil, incluindo alertas de acesso administrativo.</p>
        </div>
      ) : null}
    </div>
  );
}

function MemberPicker({ open, onOpenChange, members, selected, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; members: RbacMemberOption[]; selected: RbacMemberOption | null; onSelect: (userId: string) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="Usuário para simulação" aria-expanded={open} className="h-11 w-full justify-between px-3 font-normal">
          <span className="min-w-0 truncate text-left">{selected ? `${selected.displayName} · ${selected.email}` : "Buscar por nome ou e-mail"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Buscar membro..." />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem key={member.userId} value={`${member.displayName} ${member.email}`} className="min-h-11" onSelect={() => { onSelect(member.userId); onOpenChange(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", selected?.userId === member.userId ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <span className="min-w-0"><span className="block truncate font-medium">{member.displayName}</span><span className="block truncate text-xs text-muted-foreground">{member.email}</span></span>
                  {!member.isActive && <Badge variant="outline" className="ml-auto">Inativo</Badge>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SimulationResult({ simulation }: { simulation: NonNullable<ReturnType<typeof useRbacAccessSimulator>["simulation"]> }) {
  return (
    <div className="space-y-4" aria-live="polite">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do acesso simulado">
        <SummaryCard label="Usuário" value={simulation.displayName} helper={simulation.isActive ? "Conta ativa" : "Conta inativa"} />
        <SummaryCard label="Módulos" value={String(simulation.moduleProfiles.length)} helper="com perfil atribuído" />
        <SummaryCard label="Permissões" value={String(simulation.permissionCount)} helper="concessões catalogadas" />
      </section>

      {simulation.hasAdministrativeBypass && (
        <Alert className="border-amber-300 bg-amber-500/5 dark:border-amber-800">
          <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <AlertTitle>Acesso administrativo ampliado</AlertTitle>
          <AlertDescription>Este usuário é administrador da organização ou da plataforma. Ele pode ter acessos adicionais que não aparecem no catálogo abaixo.</AlertDescription>
        </Alert>
      )}
      {!simulation.isActive && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Conta inativa</AlertTitle><AlertDescription>Os perfis permanecem registrados, mas o acesso organizacional está bloqueado.</AlertDescription></Alert>
      )}

      {simulation.moduleProfiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center"><KeyRound className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">Nenhum perfil de módulo atribuído</p><p className="mt-1 text-sm text-muted-foreground">Use a aba Atribuições para definir o acesso deste usuário.</p></div>
      ) : (
        <Accordion type="multiple" defaultValue={simulation.moduleProfiles.map((profile) => profile.moduleKey)} className="space-y-3">
          {simulation.moduleProfiles.map((profile) => <ModuleAccess key={`${profile.moduleKey}:${profile.profileKey}`} profile={profile} />)}
        </Accordion>
      )}
    </div>
  );
}

function ModuleAccess({ profile }: { profile: RbacSimulatedModuleProfile }) {
  const module = RBAC_MODULES.find((item) => item.key === profile.moduleKey);
  const ModuleIcon = module?.icon ?? KeyRound;
  const groups = Array.from(profile.permissions.reduce((map, permission) => {
    const current = map.get(permission.groupKey) ?? [];
    current.push(permission);
    map.set(permission.groupKey, current);
    return map;
  }, new Map<string, typeof profile.permissions>()));

  return (
    <AccordionItem value={profile.moduleKey} className="overflow-hidden rounded-2xl border bg-card px-4 shadow-sm sm:px-5">
      <AccordionTrigger className="min-h-16 py-4 hover:no-underline">
        <span className="flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ModuleIcon className="h-5 w-5" aria-hidden="true" /></span>
          <span className="min-w-0"><span className="block font-semibold">{module?.label ?? profile.moduleKey}</span><span className="block truncate text-xs font-normal text-muted-foreground">{profile.profileName} · {profile.permissionCount} permissões</span></span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        {!profile.isProfileActive && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertDescription>O perfil atribuído não está ativo no catálogo.</AlertDescription></Alert>}
        {groups.length === 0 ? <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Este perfil não concede permissões catalogadas neste módulo.</p> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map(([groupKey, permissions]) => (
              <section key={groupKey} className="rounded-xl border p-3">
                <h4 className="text-sm font-semibold">{getRbacGroupLabel(groupKey)}</h4>
                <ul className="mt-2 space-y-2">
                  {permissions.map((permission) => <li key={permission.key} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /><span><span className="block">{permission.label}</span><span className="block text-xs text-muted-foreground">{permission.key}</span></span></li>)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <Card className="shadow-sm"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-semibold tabular-nums" title={value}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></CardContent></Card>;
}

function SimulatorSkeleton() {
  return <div className="space-y-4" aria-busy="true" aria-label="Carregando simulador de acesso"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
}
