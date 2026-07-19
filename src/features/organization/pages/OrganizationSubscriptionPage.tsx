import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Calendar,
  CreditCard,
  Loader2,
  Pause,
  Play,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationUsage } from "@/features/organization/hooks/useOrganizationUsage";
import {
  listPlatformPlans,
  listPlatformOrganizationSubscriptions,
  transitionPlatformSubscription,
  type PlatformOrganizationSubscription,
  type PlatformPlan,
} from "@/features/platform/services/plans.service";

// ============================================================
// TYPES
// ============================================================

interface SubscriptionAction {
  type:
    | "upgrade"
    | "downgrade"
    | "suspend"
    | "resume"
    | "cancel"
    | "trial"
    | "extend_trial";
  subscription: PlatformOrganizationSubscription;
}

// ============================================================
// HELPERS
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trialing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  past_due: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  canceled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trialing: "Trial",
  pending: "Pendente",
  past_due: "Atrasada",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function OrganizationSubscriptionPage() {
  const navigate = useNavigate();
  const { currentOrganizationId } = useOrganization();
  const { entitlements, usageDetails, loading: usageLoading } =
    useOrganizationUsage();

  const [subscriptions, setSubscriptions] = useState<
    PlatformOrganizationSubscription[]
  >([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<SubscriptionAction | null>(null);
  const [saving, setSaving] = useState(false);

  const subscription = useMemo(
    () =>
      subscriptions.find((s) => s.orgId === currentOrganizationId),
    [subscriptions, currentOrganizationId],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [subs, plns] = await Promise.all([
        listPlatformOrganizationSubscriptions(),
        listPlatformPlans(),
      ]);
      setSubscriptions(subs);
      setPlans(plns);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar dados",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [currentOrganizationId]);

  const handleAction = async (
    type: SubscriptionAction["type"],
    sub: PlatformOrganizationSubscription,
  ) => {
    setAction({ type, subscription: sub });
  };

  const executeAction = async () => {
    if (!action) return;
    setSaving(true);
    try {
      switch (action.type) {
        case "suspend":
          await transitionPlatformSubscription(
            action.subscription.orgId,
            action.subscription.planId!,
            "suspended",
            "Suspensão manual via admin",
          );
          toast.success("Assinatura suspensa");
          break;
        case "resume":
          await transitionPlatformSubscription(
            action.subscription.orgId,
            action.subscription.planId!,
            "active",
            "Reativação manual via admin",
          );
          toast.success("Assinatura reativada");
          break;
        case "cancel":
          await transitionPlatformSubscription(
            action.subscription.orgId,
            action.subscription.planId!,
            "canceled",
            "Cancelamento manual via admin",
          );
          toast.success("Assinatura cancelada");
          break;
      }
      setAction(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao executar ação",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || usageLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Nenhuma assinatura encontrada
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta organização ainda não possui uma assinatura ativa.
            </p>
            <Button onClick={() => navigate("/platform/subscriptions")}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Assinatura
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assinatura</h1>
          <p className="text-muted-foreground">
            {subscription.orgName} ({subscription.orgSlug})
          </p>
        </div>
        <div className="flex gap-2">
          {subscription.subscriptionStatus === "active" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("suspend", subscription)}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspender
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction("cancel", subscription)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          {subscription.subscriptionStatus === "suspended" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("resume", subscription)}
            >
              <Play className="h-4 w-4 mr-2" />
              Reativar
            </Button>
          )}
          {subscription.subscriptionStatus === "trialing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await transitionPlatformSubscription(
                    subscription.orgId,
                    subscription.planId!,
                    "active",
                    "Conversão de trial via admin",
                  );
                  toast.success("Trial convertido para assinatura ativa");
                  await load();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Erro ao converter trial",
                  );
                }
              }}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Converter Trial
            </Button>
          )}
        </div>
      </div>

      {/* Status & Plan Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={
                STATUS_COLORS[subscription.subscriptionStatus ?? ""] ?? ""
              }
            >
              {STATUS_LABELS[subscription.subscriptionStatus ?? ""] ??
                subscription.subscriptionStatus}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {subscription.planName ?? "Sem plano"}
            </p>
            <p className="text-xs text-muted-foreground">
              Código: {subscription.planCode ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vigência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatDate(subscription.startsAt)} —{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
            {subscription.trialEndsAt && (
              <p className="text-xs text-blue-400 mt-1">
                Trial termina em: {formatDate(subscription.trialEndsAt)}
              </p>
            )}
            {subscription.canceledAt && (
              <p className="text-xs text-red-400 mt-1">
                Cancelada em: {formatDate(subscription.canceledAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage */}
      {usageDetails && usageDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Consumo do Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {usageDetails.map((u) => (
                <div
                  key={u.usageCode}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{u.usageCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.usedValue} / {u.limitValue ?? "∞"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      u.status === "reached"
                        ? "border-red-500/30 text-red-400"
                        : u.status === "warning"
                          ? "border-yellow-500/30 text-yellow-400"
                          : "border-emerald-500/30 text-emerald-400"
                    }
                  >
                    {u.status === "reached"
                      ? "Limite atingido"
                      : u.status === "warning"
                        ? "Próximo do limite"
                        : "OK"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entitlements */}
      {entitlements && entitlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Entitlements Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {entitlements
                .filter((e) => e.enabled)
                .slice(0, 12)
                .map((e) => (
                  <div
                    key={e.featureKey}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <span className="text-xs font-medium">
                      {e.featureKey}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {e.limitValue ?? "∞"}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.type === "suspend" && "Suspender Assinatura"}
              {action?.type === "resume" && "Reativar Assinatura"}
              {action?.type === "cancel" && "Cancelar Assinatura"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {action?.type === "suspend" &&
              "A assinatura será suspensa e o acesso será bloqueado até reativação."}
            {action?.type === "resume" &&
              "A assinatura será reativada e o acesso será restaurado."}
            {action?.type === "cancel" &&
              "Esta ação é irreversível. A assinatura será cancelada permanentemente."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={action?.type === "cancel" ? "destructive" : "default"}
              onClick={executeAction}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
