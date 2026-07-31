import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RBAC_MODULES } from "@/features/rbac/rbacCatalog";
import { useRbacGovernance } from "@/features/rbac/hooks/useRbacGovernance";
import type { RbacGovernanceRequest } from "@/features/rbac/types";

type ReviewState = {
  request: RbacGovernanceRequest;
  decision: "approve" | "reject";
} | null;

export function RbacGovernancePanel() {
  const { overview, loading, reviewing, error, refresh, review } = useRbacGovernance();
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [note, setNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const activeTemporary = useMemo(
    () => overview.temporaryAssignments.filter((item) => !item.isExpired).length,
    [overview.temporaryAssignments],
  );

  async function submitReview() {
    if (!reviewState) return;
    if (reviewState.decision === "reject" && note.trim().length < 10) {
      setReviewError("Explique a rejeição em pelo menos 10 caracteres.");
      return;
    }
    setReviewError(null);
    try {
      await review(reviewState.request, reviewState.decision, note);
      setReviewState(null);
      setNote("");
    } catch (failure) {
      setReviewError(failure instanceof Error ? failure.message : "Não foi possível concluir a revisão.");
    }
  }

  if (loading) return <GovernanceSkeleton />;
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar a governança</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button variant="outline" className="h-11" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da governança">
        <MetricCard label="Aguardando revisão" value={overview.pendingRequests.length}
          description="mudanças privilegiadas" icon={UserRoundCheck} tone="amber" />
        <MetricCard label="Acessos temporários" value={activeTemporary}
          description="vigentes neste momento" icon={CalendarClock} tone="blue" />
        <MetricCard label="Sinais para revisar" value={overview.recommendations.length}
          description={`atividade dos últimos ${overview.activityWindowDays} dias`} icon={Sparkles} tone="violet" />
      </section>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle>Governança baseada em evidências</AlertTitle>
        <AlertDescription>
          Recomendações usam status do membro, expiração e eventos gerais de atividade. Elas apoiam a decisão do administrador, mas não afirmam o uso de cada permissão individual.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="approvals" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-12 min-w-max rounded-xl p-1">
            <TabsTrigger value="approvals" className="h-10 gap-2 px-4">
              Aprovações <Badge variant="secondary">{overview.pendingRequests.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="temporary" className="h-10 gap-2 px-4">
              Temporários <Badge variant="secondary">{overview.temporaryAssignments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="h-10 gap-2 px-4">
              Menor privilégio <Badge variant="secondary">{overview.recommendations.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="approvals" className="mt-0">
          {overview.pendingRequests.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tudo revisado"
              description="Não há alterações privilegiadas aguardando um segundo administrador." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {overview.pendingRequests.map((request) => {
                const snapshot = request.proposedSnapshot;
                const permissionKeys = Array.isArray(snapshot.permission_keys) ? snapshot.permission_keys : [];
                return (
                  <Card key={request.id} className="shadow-sm">
                    <CardHeader className="space-y-3 pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{String(snapshot.display_name ?? request.profileKey)}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {request.changeType === "create" ? "Criação" : "Alteração"} solicitada por {request.requesterName}
                          </p>
                        </div>
                        <RiskBadge level={request.riskLevel} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                        <div><span className="block text-xs text-muted-foreground">Permissões</span><strong>{permissionKeys.length}</strong></div>
                        <div><span className="block text-xs text-muted-foreground">Expira em</span><strong>{formatRelative(request.expiresAt)}</strong></div>
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {request.riskReasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" className="h-11" disabled={!request.canReview}
                          onClick={() => { setReviewState({ request, decision: "reject" }); setReviewError(null); }}>
                          <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                        </Button>
                        <Button className="h-11" disabled={!request.canReview}
                          onClick={() => { setReviewState({ request, decision: "approve" }); setReviewError(null); }}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                        </Button>
                      </div>
                      {!request.canReview && <p className="text-xs text-amber-700 dark:text-amber-300">A separação de funções exige outro administrador para revisar sua solicitação.</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="temporary" className="mt-0">
          {overview.temporaryAssignments.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhum acesso temporário"
              description="Defina um prazo ao editar a atribuição de um usuário." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {overview.temporaryAssignments.map((item) => (
                <Card key={`${item.userId}:${item.moduleKey}`} className={cn("shadow-sm", item.isExpired && "border-destructive/40")}>
                  <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", item.isExpired ? "bg-destructive/10 text-destructive" : "bg-blue-500/10 text-blue-600 dark:text-blue-400")}>
                      <Clock3 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.displayName}</h3>
                        <Badge variant={item.isExpired ? "destructive" : "secondary"}>{item.isExpired ? "Expirado" : formatRelative(item.expiresAt)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{getRbacModuleLabel(item.moduleKey)} · {item.profileName}</p>
                      <p className="mt-2 text-sm">{item.justification}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Prazo: {formatDateTime(item.expiresAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0">
          {overview.recommendations.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nenhum sinal crítico"
              description="As atribuições atuais estão coerentes com os sinais disponíveis." />
          ) : (
            <div className="space-y-3">
              {overview.recommendations.map((item) => (
                <Card key={item.id} className="shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", item.severity === "high" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.displayName}</h3>
                        <Badge variant="outline">{getRbacModuleLabel(item.moduleKey)}</Badge>
                        <Badge variant={item.severity === "high" ? "destructive" : "secondary"}>{item.severity === "high" ? "Alta" : "Média"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.profileName}</p>
                      <p className="mt-2 text-sm">{item.evidence}</p>
                    </div>
                    <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                      <strong className="block text-sm text-foreground tabular-nums">{item.events90d}</strong>
                      eventos em {overview.activityWindowDays} dias
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(reviewState)} onOpenChange={(open) => !open && !reviewing && setReviewState(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reviewState?.decision === "approve" ? "Aprovar alteração privilegiada" : "Rejeitar alteração"}</DialogTitle>
            <DialogDescription>
              {reviewState?.decision === "approve"
                ? "A configuração será aplicada imediatamente e registrada na auditoria."
                : "A configuração não será aplicada. Informe o motivo para orientar o solicitante."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="review-note">Observação {reviewState?.decision === "reject" ? "obrigatória" : "opcional"}</Label>
            <Textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)}
              className="min-h-24" maxLength={280} placeholder="Contexto da decisão" />
            {reviewError && <p className="text-sm text-destructive" role="alert">{reviewError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11" disabled={reviewing} onClick={() => setReviewState(null)}>Cancelar</Button>
            <Button variant={reviewState?.decision === "reject" ? "destructive" : "default"}
              className="h-11" disabled={reviewing} onClick={() => void submitReview()}>
              {reviewing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, description, icon: Icon, tone }: { label: string; value: number; description: string; icon: typeof ShieldAlert; tone: "amber" | "blue" | "violet" }) {
  const tones = { amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400", blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400", violet: "bg-primary/10 text-primary" };
  return <Card className="shadow-sm"><CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[tone])}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof ShieldAlert; title: string; description: string }) {
  return <Card className="border-dashed"><CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Icon className="h-6 w-6" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}

function RiskBadge({ level }: { level: "high" | "critical" }) {
  return <Badge variant={level === "critical" ? "destructive" : "secondary"}>{level === "critical" ? "Risco crítico" : "Risco alto"}</Badge>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getRbacModuleLabel(moduleKey: string) {
  return RBAC_MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey;
}

function formatRelative(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const days = Math.ceil(Math.abs(diff) / 86_400_000);
  return diff <= 0 ? `há ${days} dia(s)` : `em ${days} dia(s)`;
}

function GovernanceSkeleton() {
  return <div className="space-y-4" aria-busy="true" aria-label="Carregando governança"><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
}
