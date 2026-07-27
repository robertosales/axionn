import { useEffect, useMemo, useState } from "react";
import { Edit3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/features/platform/components/PlatformShell";
import { useSearchParams } from "react-router-dom";
import {
  deletePlatformOrganizationOverride,
  listPlatformOrganizationSubscriptions,
  listPlatformPlans,
  setPlatformOrganizationSubscription,
  SUBSCRIPTION_STATUS_OPTIONS,
  upsertPlatformOrganizationOverride,
  type PlatformOrganizationSubscription,
  type PlatformPlan,
  type SubscriptionStatus,
} from "@/features/platform/services/plans.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const FEATURE_LABELS: Record<string, string> = {
  "users.max": "Usuarios",
  "projects.max": "Projetos",
  "contracts.max": "Contratos",
  "apf.countings.monthly": "Contagens APF mensais",
  "ai.calls.monthly": "Chamadas de IA mensais",
  "apf.ai_generation": "Geracao de APF com IA",
  "reports.advanced": "Relatorios avancados",
  "audit.access": "Auditoria de acessos",
};

const COMMON_FEATURES = Object.keys(FEATURE_LABELS);

interface SubscriptionForm {
  orgId: string;
  orgName: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface OverrideForm {
  orgId: string;
  orgName: string;
  featureKey: string;
  enabled: "inherit" | "true" | "false";
  limitValue: string;
  reason: string;
  startsAt: string;
  endsAt: string;
}

function formatLimit(value: number | null) {
  return value === null ? "Ilimitado" : new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function parseLimit(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Limite deve ser um numero positivo ou vazio para ilimitado.");
  }
  return parsed;
}

function toSubscriptionForm(
  subscription: PlatformOrganizationSubscription,
  plans: PlatformPlan[],
): SubscriptionForm {
  return {
    orgId: subscription.orgId,
    orgName: subscription.orgName,
    planId: subscription.planId ?? plans[0]?.id ?? "",
    status: subscription.subscriptionStatus ?? "active",
    trialEndsAt: toDateInput(subscription.trialEndsAt),
    currentPeriodStart: toDateInput(subscription.currentPeriodStart),
    currentPeriodEnd: toDateInput(subscription.currentPeriodEnd),
  };
}

function toOverrideForm(
  subscription: PlatformOrganizationSubscription,
  override?: PlatformOrganizationSubscription["overrides"][number],
): OverrideForm {
  return {
    orgId: subscription.orgId,
    orgName: subscription.orgName,
    featureKey: override?.featureKey ?? "",
    enabled:
      override?.enabled === null || override?.enabled === undefined
        ? "inherit"
        : override.enabled
          ? "true"
          : "false",
    limitValue:
      override?.limitValue === null || override?.limitValue === undefined
        ? ""
        : String(override.limitValue),
    reason: override?.reason ?? "",
    startsAt: toDateInput(override?.startsAt ?? null),
    endsAt: toDateInput(override?.endsAt ?? null),
  };
}

export default function PlatformSubscriptionsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    PlatformOrganizationSubscription[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriptionForm, setSubscriptionForm] =
    useState<SubscriptionForm | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm | null>(null);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === "active"),
    [plans],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [planRows, subscriptionRows] = await Promise.all([
        listPlatformPlans(false),
        listPlatformOrganizationSubscriptions(),
      ]);
      setPlans(planRows);
      setSubscriptions(subscriptionRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar assinaturas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const organizationId = searchParams.get("organization");
    if (loading || !organizationId || subscriptionForm) return;
    const subscription = subscriptions.find((item) => item.orgId === organizationId);
    if (!subscription) return;
    setSubscriptionForm(toSubscriptionForm(subscription, activePlans));
    setSearchParams({}, { replace: true });
  }, [
    activePlans,
    loading,
    searchParams,
    setSearchParams,
    subscriptionForm,
    subscriptions,
  ]);

  const saveSubscription = async () => {
    if (!subscriptionForm) return;
    if (!subscriptionForm.planId) return toast.error("Plano e obrigatorio");

    setSaving(true);
    try {
      await setPlatformOrganizationSubscription({
        orgId: subscriptionForm.orgId,
        planId: subscriptionForm.planId,
        status: subscriptionForm.status,
        trialEndsAt: subscriptionForm.trialEndsAt || null,
        currentPeriodStart: subscriptionForm.currentPeriodStart || null,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd || null,
      });
      toast.success("Assinatura atualizada");
      setSubscriptionForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async () => {
    if (!overrideForm) return;
    if (!overrideForm.featureKey.trim()) return toast.error("Recurso e obrigatorio");
    if (!overrideForm.reason.trim()) return toast.error("Justificativa e obrigatoria");
    if (overrideForm.startsAt && overrideForm.endsAt && overrideForm.endsAt <= overrideForm.startsAt) return toast.error("Fim da vigencia deve ser posterior ao inicio");

    setSaving(true);
    try {
      await upsertPlatformOrganizationOverride({
        orgId: overrideForm.orgId,
        featureKey: overrideForm.featureKey.trim(),
        enabled:
          overrideForm.enabled === "inherit"
            ? null
            : overrideForm.enabled === "true",
        limitValue: parseLimit(overrideForm.limitValue),
        reason: overrideForm.reason.trim() || null,
        startsAt: overrideForm.startsAt || null,
        endsAt: overrideForm.endsAt || null,
      });
      toast.success("Override atualizado");
      setOverrideForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar override");
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (orgId: string, featureKey: string) => {
    setSaving(true);
    try {
      await deletePlatformOrganizationOverride(orgId, featureKey);
      toast.success("Override removido");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover override");
    } finally {
      setSaving(false);
    }
  };

  const content = (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Assinaturas</h1>
          <p className="text-sm text-muted-foreground">
            Controle global de plano, status e excecoes por organizacao.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizacao</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Overrides</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.orgId}>
                    <TableCell>
                      <div className="font-medium">{subscription.orgName}</div>
                      <div className="text-xs text-muted-foreground">
                        {subscription.orgSlug || subscription.orgId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {subscription.planName ?? "Sem assinatura"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subscription.planCode ?? subscription.orgPlan}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant={
                            subscription.subscriptionStatus === "active"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {subscription.subscriptionStatus ?? "missing"}
                        </Badge>
                        <Badge variant="outline">{subscription.orgStatus}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{subscription.usersUsed} usuarios</div>
                      <div className="text-muted-foreground">
                        {subscription.projectsUsed} projetos,{" "}
                        {subscription.contractsUsed} contratos
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscription.overrides.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Nenhum</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {subscription.overrides.map((override) => (
                            <Badge key={override.id} variant="outline">
                              {FEATURE_LABELS[override.featureKey] ?? override.featureKey}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSubscriptionForm(
                            toSubscriptionForm(subscription, activePlans),
                          )
                        }
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setOverrideForm(toOverrideForm(subscription))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading &&
          subscriptions
            .filter((subscription) => subscription.overrides.length > 0)
            .map((subscription) => (
              <div key={`${subscription.orgId}-overrides`} className="rounded-lg border bg-card p-4">
                <div className="mb-3 font-medium">{subscription.orgName}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.overrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell>
                          {FEATURE_LABELS[override.featureKey] ?? override.featureKey}
                          <div className="text-xs text-muted-foreground">
                            {override.featureKey}
                          </div>
                        </TableCell>
                        <TableCell>
                          {override.enabled === null
                            ? "Herdado"
                            : override.enabled
                              ? "Ativo"
                              : "Inativo"}
                        </TableCell>
                        <TableCell>{formatLimit(override.limitValue)}</TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {override.reason ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setOverrideForm(toOverrideForm(subscription, override))
                            }
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={saving}
                            onClick={() =>
                              void removeOverride(subscription.orgId, override.featureKey)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

        <Dialog
          open={Boolean(subscriptionForm)}
          onOpenChange={(open) => !open && setSubscriptionForm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar assinatura</DialogTitle>
            </DialogHeader>
            {subscriptionForm && (
              <div className="grid gap-4">
                <div>
                  <p className="font-medium">{subscriptionForm.orgName}</p>
                  <p className="text-sm text-muted-foreground">
                    Ciclo atual ate {formatDate(subscriptionForm.currentPeriodEnd || null)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={subscriptionForm.planId}
                    onValueChange={(planId) =>
                      setSubscriptionForm((current) =>
                        current ? { ...current, planId } : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={subscriptionForm.status}
                    onValueChange={(status) =>
                      setSubscriptionForm((current) =>
                        current
                          ? { ...current, status: status as SubscriptionStatus }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Fim do trial</Label>
                    <Input
                      type="date"
                      value={subscriptionForm.trialEndsAt}
                      onChange={(event) =>
                        setSubscriptionForm((current) =>
                          current
                            ? { ...current, trialEndsAt: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inicio ciclo</Label>
                    <Input
                      type="date"
                      value={subscriptionForm.currentPeriodStart}
                      onChange={(event) =>
                        setSubscriptionForm((current) =>
                          current
                            ? { ...current, currentPeriodStart: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim ciclo</Label>
                    <Input
                      type="date"
                      value={subscriptionForm.currentPeriodEnd}
                      onChange={(event) =>
                        setSubscriptionForm((current) =>
                          current
                            ? { ...current, currentPeriodEnd: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubscriptionForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void saveSubscription()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(overrideForm)}
          onOpenChange={(open) => !open && setOverrideForm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override de recurso</DialogTitle>
            </DialogHeader>
            {overrideForm && (
              <div className="grid gap-4">
                <div>
                  <p className="font-medium">{overrideForm.orgName}</p>
                  <p className="text-sm text-muted-foreground">
                    Configuracao especifica da organizacao.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Recurso</Label>
                  <Select
                    value={overrideForm.featureKey}
                    onValueChange={(featureKey) =>
                      setOverrideForm((current) =>
                        current ? { ...current, featureKey } : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_FEATURES.map((featureKey) => (
                        <SelectItem key={featureKey} value={featureKey}>
                          {FEATURE_LABELS[featureKey]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={overrideForm.enabled}
                    onValueChange={(enabled) =>
                      setOverrideForm((current) =>
                        current
                          ? { ...current, enabled: enabled as OverrideForm["enabled"] }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Herdar do plano</SelectItem>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limite</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="Vazio para manter limite do plano"
                    value={overrideForm.limitValue}
                    onChange={(event) =>
                      setOverrideForm((current) =>
                        current ? { ...current, limitValue: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Início da vigência</Label><Input type="date" value={overrideForm.startsAt} onChange={(event) => setOverrideForm((current) => current ? { ...current, startsAt: event.target.value } : current)} /></div>
                  <div className="space-y-2"><Label>Fim da vigência</Label><Input type="date" min={overrideForm.startsAt || undefined} value={overrideForm.endsAt} onChange={(event) => setOverrideForm((current) => current ? { ...current, endsAt: event.target.value } : current)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea
                    value={overrideForm.reason}
                    onChange={(event) =>
                      setOverrideForm((current) =>
                        current ? { ...current, reason: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void saveOverride()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  return embedded ? content : <PlatformShell>{content}</PlatformShell>;
}
