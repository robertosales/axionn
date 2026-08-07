import { useEffect, useMemo, useState } from "react";
import { Check, GitCompareArrows, Minus, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRbacGroupLabel, RBAC_MODULES } from "@/features/rbac/rbacCatalog";
import type { RbacPermission, RbacProfile } from "@/features/rbac/types";

interface RbacProfileComparisonDialogProps {
  open: boolean;
  profiles: RbacProfile[];
  permissions: RbacPermission[];
  onOpenChange: (open: boolean) => void;
}

export function RbacProfileComparisonDialog({
  open,
  profiles,
  permissions,
  onOpenChange,
}: RbacProfileComparisonDialogProps) {
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLeftKey((current) => current || profiles[0]?.key || "");
    setRightKey((current) => current || profiles[1]?.key || profiles[0]?.key || "");
  }, [open, profiles]);

  const left = profiles.find((profile) => profile.key === leftKey) ?? null;
  const right = profiles.find((profile) => profile.key === rightKey) ?? null;
  const leftPermissions = useMemo(() => new Set(left?.permissionKeys ?? []), [left]);
  const rightPermissions = useMemo(() => new Set(right?.permissionKeys ?? []), [right]);

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const visible = permissions.filter((permission) => {
      const assigned = leftPermissions.has(permission.key) || rightPermissions.has(permission.key);
      const matches = !term || [permission.label, permission.key, permission.description]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term);
      return assigned && matches;
    });

    return Array.from(
      visible.reduce((map, permission) => {
        const key = `${permission.moduleKey}:${permission.groupKey}`;
        const current = map.get(key) ?? [];
        current.push(permission);
        map.set(key, current);
        return map;
      }, new Map<string, RbacPermission[]>()),
    );
  }, [leftPermissions, permissions, rightPermissions, search]);

  const commonCount = left && right
    ? left.permissionKeys.filter((key) => rightPermissions.has(key)).length
    : 0;
  const onlyLeftCount = left
    ? left.permissionKeys.filter((key) => !rightPermissions.has(key)).length
    : 0;
  const onlyRightCount = right
    ? right.permissionKeys.filter((key) => !leftPermissions.has(key)).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl flex-col overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Comparar perfis</DialogTitle>
              <DialogDescription className="mt-1">
                Identifique permissões em comum e diferenças antes de alterar atribuições.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ProfileSelect label="Perfil A" value={leftKey} profiles={profiles} onChange={setLeftKey} />
            <ProfileSelect label="Perfil B" value={rightKey} profiles={profiles} onChange={setRightKey} />
          </div>

          {left && right && left.key === right.key ? (
            <div className="mt-5 rounded-xl border border-dashed bg-muted/30 p-6 text-center">
              <p className="font-medium">Escolha dois perfis diferentes</p>
              <p className="mt-1 text-sm text-muted-foreground">A comparação realça o que muda entre os acessos.</p>
            </div>
          ) : left && right ? (
            <>
              <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Resumo da comparação">
                <ComparisonMetric label="Em comum" value={commonCount} />
                <ComparisonMetric label={`Só ${left.displayName}`} value={onlyLeftCount} />
                <ComparisonMetric label={`Só ${right.displayName}`} value={onlyRightCount} />
              </section>

              <div className="mt-5 grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
                <ProfileSummary profile={left} />
                <ProfileSummary profile={right} />
              </div>

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 pl-9 text-base sm:text-sm"
                  placeholder="Pesquisar nas permissões comparadas"
                  aria-label="Pesquisar permissões comparadas"
                />
              </div>

              {groups.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhuma permissão corresponde à pesquisa.
                </div>
              ) : (
                <Accordion type="multiple" defaultValue={groups.slice(0, 2).map(([key]) => key)} className="mt-4 space-y-2">
                  {groups.map(([key, groupPermissions]) => {
                    const [moduleKey, groupKey] = key.split(":");
                    const moduleLabel = RBAC_MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey;
                    return (
                      <AccordionItem key={key} value={key} className="rounded-xl border px-4">
                        <AccordionTrigger className="min-h-12 py-3 hover:no-underline">
                          <span className="text-left">
                            <span className="block font-medium">{getRbacGroupLabel(groupKey)}</span>
                            <span className="text-xs font-normal text-muted-foreground">{moduleLabel} · {groupPermissions.length} permissões</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="overflow-hidden rounded-lg border">
                            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_minmax(110px,160px)_minmax(110px,160px)]">
                              <span>Permissão</span>
                              <span className="text-center">A</span>
                              <span className="text-center">B</span>
                            </div>
                            {groupPermissions.map((permission) => (
                              <div key={permission.key} className="grid min-h-12 grid-cols-[minmax(0,1fr)_64px_64px] items-center border-t px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(110px,160px)_minmax(110px,160px)]">
                                <span className="min-w-0 pr-2">
                                  <span className="block font-medium">{permission.label}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{permission.key}</span>
                                </span>
                                <Presence present={leftPermissions.has(permission.key)} />
                                <Presence present={rightPermissions.has(permission.key)} />
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSelect({ label, value, profiles, onChange }: { label: string; value: string; profiles: RbacProfile[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11" aria-label={label}><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
        <SelectContent>
          {profiles.map((profile) => <SelectItem key={profile.key} value={profile.key}>{profile.displayName}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ComparisonMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 text-center sm:p-4">
      <p className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={label}>{label}</p>
    </div>
  );
}

function ProfileSummary({ profile }: { profile: RbacProfile }) {
  return (
    <div className="min-w-0 rounded-lg bg-background p-3">
      <p className="truncate font-semibold">{profile.displayName}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {profile.moduleKeys.map((moduleKey) => <Badge key={moduleKey} variant="outline">{RBAC_MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey}</Badge>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{profile.permissionCount} permissões · {profile.userCount} usuários</p>
    </div>
  );
}

function Presence({ present }: { present: boolean }) {
  return (
    <span className="flex justify-center" aria-label={present ? "Concedida" : "Não concedida"}>
      {present
        ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" aria-hidden="true" /></span>
        : <Minus className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />}
    </span>
  );
}
