import { useMemo, useState } from "react";
import { AlertTriangle, Archive, Download, FileClock, PencilLine, Plus, RotateCcw, Search, UserRoundCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/exportToCsv";
import { useRbacAudit } from "@/features/rbac/hooks/useRbacAudit";
import { useRbacProfiles } from "@/features/rbac/hooks/useRbacProfiles";
import { RBAC_MODULES } from "@/features/rbac/rbacCatalog";
import type { RbacAuditAction, RbacAuditEvent } from "@/features/rbac/types";

const ACTIONS: Array<{ value: RbacAuditAction; label: string }> = [
  { value: "rbac_profile_created", label: "Perfil criado" },
  { value: "rbac_profile_updated", label: "Perfil atualizado" },
  { value: "rbac_profile_archived", label: "Perfil arquivado" },
  { value: "rbac_profile_change_requested", label: "Aprovação solicitada" },
  { value: "rbac_profile_change_approved", label: "Alteração aprovada" },
  { value: "rbac_profile_change_rejected", label: "Alteração rejeitada" },
  { value: "member_profile_managed", label: "Atribuição alterada" },
];

export function RbacAuditPanel() {
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const { events, loading, error, refresh } = useRbacAudit(profileKey);
  const { profiles } = useRbacProfiles();

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return events.filter((event) => {
      const matchesAction = action === "all" || event.action === action;
      const matchesSearch = !term || [
        event.actorName,
        event.subjectName,
        event.profileKey,
        event.details.display_name,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term);
      return matchesAction && matchesSearch;
    });
  }, [action, events, search]);

  function exportAudit() {
    exportToCsv({
      filename: "historico-rbac",
      rows: filteredEvents.map((event) => ({
        Data: formatDateTime(event.createdAt),
        Evento: getActionLabel(event.action),
        Responsável: event.actorName,
        Usuário_impactado: event.subjectName,
        Perfil: event.profileKey ?? String(event.details.display_name ?? ""),
        Detalhes: describeEvent(event),
      })),
    });
  }

  if (loading) return <RbacAuditSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar o histórico</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button variant="outline" className="h-11" onClick={() => void refresh()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><FileClock className="h-5 w-5 text-primary" aria-hidden="true" />Histórico de acesso</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Rastreie criações, alterações e atribuições dentro da organização.</p>
            </div>
            <Button variant="outline" className="h-11 shrink-0" disabled={filteredEvents.length === 0} onClick={exportAudit}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9 text-base sm:text-sm" placeholder="Buscar no histórico" aria-label="Buscar no histórico" />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-11" aria-label="Filtrar por evento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {ACTIONS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={profileKey ?? "all"} onValueChange={(value) => setProfileKey(value === "all" ? null : value)}>
              <SelectTrigger className="h-11" aria-label="Filtrar por perfil"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {profiles.map((profile) => <SelectItem key={profile.key} value={profile.key}>{profile.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div aria-live="polite" className="text-sm text-muted-foreground"><strong className="font-semibold text-foreground tabular-nums">{filteredEvents.length}</strong> eventos encontrados</div>

      {filteredEvents.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <FileClock className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">Nenhuma alteração encontrada</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Ajuste os filtros ou aguarde a próxima mudança de perfil e atribuição.</p>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Eventos de auditoria RBAC">
          {filteredEvents.map((event) => <AuditEventCard key={event.id} event={event} />)}
        </ol>
      )}
    </div>
  );
}

function AuditEventCard({ event }: { event: RbacAuditEvent }) {
  const config = getActionConfig(event.action);
  const Icon = config.icon;
  const modules = getEventModules(event);
  return (
    <li className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.surface}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div><p className="font-semibold">{config.label}</p><p className="mt-0.5 text-sm text-muted-foreground">{describeEvent(event)}</p></div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>por <strong className="font-medium text-foreground">{event.actorName}</strong></span>
            {event.subjectName && <Badge variant="outline">Usuário: {event.subjectName}</Badge>}
            {modules.map((module) => <Badge key={module} variant="secondary">{RBAC_MODULES.find((item) => item.key === module)?.label ?? module}</Badge>)}
          </div>
        </div>
      </div>
    </li>
  );
}

function getActionConfig(action: RbacAuditAction) {
  if (action === "rbac_profile_created") return { label: "Perfil criado", icon: Plus, surface: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (action === "rbac_profile_updated") return { label: "Perfil atualizado", icon: PencilLine, surface: "bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  if (action === "rbac_profile_archived") return { label: "Perfil arquivado", icon: Archive, surface: "bg-amber-500/10 text-amber-800 dark:text-amber-300" };
  if (action === "rbac_profile_change_requested") return { label: "Aprovação solicitada", icon: FileClock, surface: "bg-amber-500/10 text-amber-800 dark:text-amber-300" };
  if (action === "rbac_profile_change_approved") return { label: "Alteração aprovada", icon: Plus, surface: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (action === "rbac_profile_change_rejected") return { label: "Alteração rejeitada", icon: AlertTriangle, surface: "bg-destructive/10 text-destructive" };
  return { label: "Atribuição alterada", icon: UserRoundCog, surface: "bg-violet-500/10 text-violet-700 dark:text-violet-300" };
}

function getActionLabel(action: RbacAuditAction) { return getActionConfig(action).label; }

function describeEvent(event: RbacAuditEvent) {
  const profile = String(event.details.display_name ?? event.profileKey ?? "perfil");
  if (event.action === "rbac_profile_created") return `${profile} foi adicionado ao catálogo.`;
  if (event.action === "rbac_profile_updated") return `${profile} teve módulos ou permissões atualizados.`;
  if (event.action === "rbac_profile_archived") return `${profile} deixou de aceitar novas atribuições.`;
  return `Os perfis de ${event.subjectName ?? "um usuário"} foram atualizados.`;
}

function getEventModules(event: RbacAuditEvent): string[] {
  const direct = event.details.module_keys;
  if (Array.isArray(direct)) return direct.map(String);
  const roles = event.details.module_roles;
  if (!Array.isArray(roles)) return [];
  return roles.flatMap((role) => role && typeof role === "object" && !Array.isArray(role) && "module_key" in role ? [String((role as Record<string, unknown>).module_key)] : []);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function RbacAuditSkeleton() {
  return <div className="space-y-4" aria-busy="true" aria-label="Carregando histórico RBAC"><Skeleton className="h-44 rounded-2xl" />{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>;
}
