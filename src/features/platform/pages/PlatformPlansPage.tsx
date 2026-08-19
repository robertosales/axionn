import { useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Loader2, MoreHorizontal, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/features/platform/components/PlatformShell";
import {
  archivePlatformPlan,
  createPlatformPlan,
  deletePlatformPlanEntitlement,
  listPlatformPlans,
  PLAN_STATUS_OPTIONS,
  updatePlatformPlan,
  upsertPlatformPlanEntitlement,
  type PlanStatus,
  type PlatformPlan,
  type PlatformPlanEntitlement,
} from "@/features/platform/services/plans.service";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  "users.max": "Limite de usuários",
  "projects.max": "Projetos",
  "contracts.max": "Contratos",
  "apf.countings.monthly": "Contagens APF por mês",
  "ai.calls.monthly": "Chamadas de IA por mês",
  "apf.ai_generation": "Geração de APF com IA",
  "reports.advanced": "Relatórios avançados",
  "audit.access": "Acesso à auditoria",
  "ai.briefing.enabled": "Briefing por IA",
  "ai.briefing.apply_actions": "Aplicação de ações sugeridas por IA",
  "ai.briefing.max_input_chars": "Limite de caracteres de entrada",
  "ai.briefing.runs.monthly": "Execuções de briefing por mês",
  "ai.briefing.sprint_summary": "Resumo de sprint por IA",
  "ai.briefing.risk_analysis": "Análise de riscos por IA",
  "ai.briefing.metric_explanation": "Explicação de métricas por IA",
  "ai.briefing.recommendations": "Recomendações operacionais por IA",
  "ai.tokens.monthly": "Tokens de IA por mês",
  "ai.sprint_summary": "Resumo de sprint",
  "ai.risk_analysis": "Análise de riscos",
  "ai.metric_explanation": "Explicação de métricas",
  "ai.recommendations": "Recomendações de IA",
  "ai.custom_provider": "Provedor de IA próprio",
  "ai.audit_logs": "Auditoria de uso de IA",
  "okr.view": "Visualização de OKRs",
  "okr.create": "Criação de OKRs",
  "okr.edit": "Edição de OKRs",
  "okr.archive": "Arquivamento de OKRs",
  "okr.check_in": "Check-in de resultados-chave",
  "okr.initiatives": "Iniciativas vinculadas a OKRs",
  "okr.automatic_metrics": "Medições automáticas de OKR",
  "okr.history": "Histórico de OKRs",
  "okr.export": "Exportação de OKRs",
  "okr.ai_recommendations": "Recomendações de IA para OKRs",
  "okr.alignments": "Alinhamento de objetivos",
  "okr.cycle_management": "Gestão de ciclos OKR",
  "okr.executive_dashboard": "Painel executivo de OKR",
  "okr.advanced_alerts": "Alertas avançados de OKR",
  "briefing.connections.view": "Visualização de conexões de reuniões",
  "briefing.connections.manage": "Gestão de conexões de reuniões",
  "briefing.cross_meeting_insights": "Insights entre reuniões",
  "briefing.integrations.auto_sync": "Sincronização automática de integrações",
  "briefing.integrations.connections_max": "Limite de conexões de integrações",
  "briefing.integrations.enabled": "Integrações de reuniões",
  "briefing.integrations.meet": "Integração com Google Meet",
  "briefing.integrations.meetings_monthly": "Reuniões integradas por mês",
  "briefing.integrations.minutes_monthly": "Minutos de reuniões por mês",
  "briefing.integrations.retention_days_max": "Retenção máxima de reuniões",
  "briefing.integrations.teams": "Integração com Microsoft Teams",
  "briefing.recording_access": "Acesso às gravações de reuniões",
  "briefing.meetings.list": "Visualização de reuniões externas",
  "briefing.meetings.import": "Importação de reuniões externas",
  "briefing.process": "Processamento de briefings",
};

const COMMON_FEATURES = Object.keys(FEATURE_LABELS);

const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};

function featureLabel(featureKey: string) {
  return FEATURE_LABELS[featureKey] ?? featureKey
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

interface PlanForm {
  id?: string;
  code: string;
  name: string;
  description: string;
  status: PlanStatus;
}

interface EntitlementForm {
  planId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: string;
}

const EMPTY_PLAN_FORM: PlanForm = {
  code: "",
  name: "",
  description: "",
  status: "active",
};

function formatLimit(value: number | null) {
  return value === null ? "Ilimitado" : new Intl.NumberFormat("pt-BR").format(value);
}

function parseLimit(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("O limite deve ser um número positivo ou ficar vazio para indicar ilimitado.");
  }
  return parsed;
}

function toEntitlementForm(
  planId: string,
  entitlement?: PlatformPlanEntitlement,
): EntitlementForm {
  return {
    planId,
    featureKey: entitlement?.featureKey ?? "",
    enabled: entitlement?.enabled ?? true,
    limitValue:
      entitlement?.limitValue === null || entitlement?.limitValue === undefined
        ? ""
        : String(entitlement.limitValue),
  };
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN_FORM);
  const [entitlementForm, setEntitlementForm] = useState<EntitlementForm | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PlatformPlan | null>(null);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === "active").length,
    [plans],
  );

  const load = async () => {
    setLoading(true);
    try {
      setPlans(await listPlatformPlans(includeArchived));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao listar planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [includeArchived]);

  const openCreate = () => {
    setPlanForm(EMPTY_PLAN_FORM);
    setPlanFormOpen(true);
  };

  const openEdit = (plan: PlatformPlan) => {
    setPlanForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      status: plan.status,
    });
    setPlanFormOpen(true);
  };

  const savePlan = async () => {
    if (!planForm.name.trim()) return toast.error("O nome é obrigatório.");
    if (!planForm.id && !planForm.code.trim()) return toast.error("O código é obrigatório.");

    setSaving(true);
    try {
      if (planForm.id) {
        const current = plans.find((plan) => plan.id === planForm.id);
        await updatePlatformPlan({
          id: planForm.id,
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          status: planForm.status,
          metadata: current?.metadata ?? {},
        });
        toast.success("Plano atualizado com sucesso.");
      } else {
        await createPlatformPlan({
          code: planForm.code.trim().toLowerCase(),
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          status: planForm.status,
        });
        toast.success("Plano criado com sucesso.");
      }

      setPlanFormOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const saveEntitlement = async () => {
    if (!entitlementForm) return;
    if (!entitlementForm.featureKey.trim()) return toast.error("O recurso é obrigatório.");

    setSaving(true);
    try {
      await upsertPlatformPlanEntitlement({
        planId: entitlementForm.planId,
        featureKey: entitlementForm.featureKey.trim(),
        enabled: entitlementForm.enabled,
        limitValue: parseLimit(entitlementForm.limitValue),
      });
      toast.success("Recurso atualizado com sucesso.");
      setEntitlementForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar recurso");
    } finally {
      setSaving(false);
    }
  };

  const removeEntitlement = async (plan: PlatformPlan, entitlement: PlatformPlanEntitlement) => {
    setSaving(true);
    try {
      await deletePlatformPlanEntitlement(plan.id, entitlement.featureKey);
      toast.success("Recurso removido com sucesso.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover recurso");
    } finally {
      setSaving(false);
    }
  };

  const archivePlan = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await archivePlatformPlan(archiveTarget.id);
      toast.success("Plano arquivado com sucesso.");
      setArchiveTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao arquivar plano");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Planos SaaS</h1>
            <p className="text-sm text-muted-foreground">
              {plans.length} {plans.length === 1 ? "plano" : "planos"}, {activePlans}{" "}
              {activePlans === 1 ? "plano ativo" : "planos ativos"}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} />
              Arquivados
            </label>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo plano
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <Badge variant="outline">{plan.code}</Badge>
                      <Badge variant={plan.status === "active" ? "secondary" : "outline"}>
                        {PLAN_STATUS_LABELS[plan.status]}
                      </Badge>
                    </div>
                    {plan.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(plan)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Editar plano
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEntitlementForm(toEntitlementForm(plan.id))}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Novo recurso
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setArchiveTarget(plan)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recurso habilitado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.entitlements.map((entitlement) => (
                        <TableRow key={entitlement.id}>
                          <TableCell className="font-medium">
                            {featureLabel(entitlement.featureKey)}
                            <div className="text-xs text-muted-foreground">
                              Identificador interno: {entitlement.featureKey}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={entitlement.enabled ? "secondary" : "outline"}>
                              {entitlement.enabled ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatLimit(entitlement.limitValue)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setEntitlementForm(
                                  toEntitlementForm(plan.id, entitlement),
                                )
                              }
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={saving}
                              onClick={() => void removeEntitlement(plan, entitlement)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={planFormOpen} onOpenChange={setPlanFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{planForm.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Código interno</Label>
                <Input
                  value={planForm.code}
                  disabled={Boolean(planForm.id)}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={planForm.name}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={planForm.status}
                  onValueChange={(status) =>
                    setPlanForm((current) => ({
                      ...current,
                      status: status as PlanStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PLAN_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={planForm.description}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPlanFormOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void savePlan()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(entitlementForm)}
          onOpenChange={(open) => !open && setEntitlementForm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recurso do plano</DialogTitle>
            </DialogHeader>
            {entitlementForm && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Recurso</Label>
                  <Select
                    value={entitlementForm.featureKey}
                    onValueChange={(featureKey) =>
                      setEntitlementForm((current) =>
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
                          {featureLabel(featureKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limite do recurso</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="Deixe vazio para ilimitado"
                    value={entitlementForm.limitValue}
                    onChange={(event) =>
                      setEntitlementForm((current) =>
                        current ? { ...current, limitValue: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={entitlementForm.enabled}
                    onCheckedChange={(enabled) =>
                      setEntitlementForm((current) =>
                        current ? { ...current, enabled } : current,
                      )
                    }
                  />
                  Ativo
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEntitlementForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void saveEntitlement()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Arquivar plano?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {archiveTarget?.name} ficará indisponível para novas assinaturas.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArchiveTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => void archivePlan()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Arquivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PlatformShell>
  );
}
