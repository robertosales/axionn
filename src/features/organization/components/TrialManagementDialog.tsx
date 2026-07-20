import { useState } from "react";
import { Calendar, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { supabase } from "@/integrations/supabase/client";
import type { SaasPlan as PlatformPlan } from "@/features/platform/services/plans.service";

// ============================================================
// TYPES
// ============================================================

interface TrialManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  plans: PlatformPlan[];
  currentTrialStatus?: string | null;
  currentTrialEndsAt?: string | null;
  onSuccess: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function TrialManagementDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  plans,
  currentTrialStatus,
  currentTrialEndsAt,
  onSuccess,
}: TrialManagementDialogProps) {
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("");
  const [trialDays, setTrialDays] = useState<string>("14");
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"start" | "extend" | "convert" | "cancel">("start");

  const selectedPlan = plans.find((p) => p.code === selectedPlanCode);
  const hasActiveTrial = currentTrialStatus === "trialing" || currentTrialStatus === "scheduled";

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("transition_platform_subscription_v2" as any, {
        p_org_id: orgId,
        p_plan_version_id: selectedPlan?.versions?.find((v) => v.status === "active")?.id ?? "",
        p_target_status: action === "convert" ? "active" : "trialing",
        p_effective_at: null,
        p_reason: action === "start"
          ? `Trial iniciado: ${selectedPlanCode} (${trialDays} dias)`
          : action === "extend"
            ? `Trial estendido em ${trialDays} dias`
            : action === "convert"
              ? "Trial convertido para assinatura ativa"
              : "Trial cancelado",
        p_mode: "immediate",
      });

      if (error) throw error;

      toast.success(
        action === "start"
          ? "Trial iniciado com sucesso"
          : action === "extend"
            ? "Trial estendido com sucesso"
            : action === "convert"
              ? "Trial convertido com sucesso"
              : "Trial cancelado com sucesso",
      );
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao gerenciar trial",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gerenciar Trial
          </DialogTitle>
          <DialogDescription>
            Gerenciar trial de <strong>{orgName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Trial Status */}
          {hasActiveTrial && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {currentTrialStatus === "trialing" ? "Em trial" : "Agendado"}
                </Badge>
                {currentTrialEndsAt && (
                  <span className="text-xs text-muted-foreground">
                    Termina em:{" "}
                    {new Date(currentTrialEndsAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="space-y-2">
            <Label>Ação</Label>
            <Select
              value={action}
              onValueChange={(v) => setAction(v as typeof action)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start" disabled={hasActiveTrial}>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Iniciar Trial
                  </div>
                </SelectItem>
                <SelectItem value="extend" disabled={!hasActiveTrial}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Estender Trial
                  </div>
                </SelectItem>
                <SelectItem value="convert" disabled={!hasActiveTrial}>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Converter para Assinatura
                  </div>
                </SelectItem>
                <SelectItem value="cancel" disabled={!hasActiveTrial}>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Cancelar Trial
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plan Selection (for start) */}
          {action === "start" && (
            <div className="space-y-2">
              <Label>Plano para Trial</Label>
              <Select value={selectedPlanCode} onValueChange={setSelectedPlanCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter((p) => p.trialAllowed && p.status === "active")
                    .map((plan) => (
                      <SelectItem key={plan.code} value={plan.code}>
                        <div className="flex items-center gap-2">
                          <span>{plan.name}</span>
                          {plan.trialDaysDefault && (
                            <Badge variant="outline" className="text-xs">
                              {plan.trialDaysDefault} dias
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Trial Days */}
          {(action === "start" || action === "extend") && (
            <div className="space-y-2">
              <Label>
                {action === "start" ? "Dias de Trial" : "Dias para Estender"}
              </Label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                min="1"
                max="90"
              />
              {selectedPlan?.trialDaysDefault && action === "start" && (
                <p className="text-xs text-muted-foreground">
                  Padrão do plano: {selectedPlan.trialDaysDefault} dias
                </p>
              )}
            </div>
          )}

          {/* Warning for convert */}
          {action === "convert" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                O trial será convertido para uma assinatura ativa. A cobrança
                começará imediatamente.
              </p>
            </div>
          )}

          {/* Warning for cancel */}
          {action === "cancel" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                O trial será cancelado e o acesso será bloqueado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {action === "start"
              ? "Iniciar Trial"
              : action === "extend"
                ? "Estender Trial"
                : action === "convert"
                  ? "Converter Trial"
                  : "Cancelar Trial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
