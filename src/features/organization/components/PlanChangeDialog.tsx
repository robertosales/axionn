import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { transitionPlatformSubscription } from "@/features/platform/services/plans.service";
import type { PlatformPlan } from "@/features/platform/services/plans.service";

// ============================================================
// TYPES
// ============================================================

interface PlanChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  currentPlanCode: string | null;
  currentPlanName: string | null;
  subscriptionStatus: string | null;
  plans: PlatformPlan[];
  onSuccess: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function PlanChangeDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  currentPlanCode,
  currentPlanName,
  subscriptionStatus,
  plans,
  onSuccess,
}: PlanChangeDialogProps) {
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPlan = plans.find((p) => p.code === selectedPlanCode);
  const isUpgrade =
    selectedPlan &&
    currentPlanCode &&
    selectedPlan.displayOrder > (plans.find((p) => p.code === currentPlanCode)?.displayOrder ?? 0);
  const isDowngrade =
    selectedPlan &&
    currentPlanCode &&
    selectedPlan.displayOrder < (plans.find((p) => p.code === currentPlanCode)?.displayOrder ?? 0);

  const handleSubmit = async () => {
    if (!selectedPlanCode) {
      toast.error("Selecione um plano");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo da alteração");
      return;
    }
    if (selectedPlanCode === currentPlanCode) {
      toast.error("O plano selecionado é igual ao atual");
      return;
    }

    const activeVersion = selectedPlan?.versions?.find(
      (v) => v.status === "active",
    );
    if (!activeVersion) {
      toast.error("Plano selecionado não possui versão ativa");
      return;
    }

    setSaving(true);
    try {
      await transitionPlatformSubscription(
        orgId,
        activeVersion.id,
        subscriptionStatus === "trialing" ? "trialing" : "active",
        `Alteração de plano: ${currentPlanCode} → ${selectedPlanCode}. Motivo: ${reason}`,
      );
      toast.success(
        isUpgrade
          ? "Plano atualizado com sucesso"
          : "Downgrade agendado com sucesso",
      );
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao alterar plano",
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
            <ArrowRightLeft className="h-5 w-5" />
            Alterar Plano
          </DialogTitle>
          <DialogDescription>
            Alterar o plano de <strong>{orgName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Plan */}
          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">
              Plano Atual
            </Label>
            <p className="text-sm font-medium mt-1">
              {currentPlanName ?? currentPlanCode ?? "Sem plano"}
            </p>
          </div>

          {/* New Plan */}
          <div className="space-y-2">
            <Label>Novo Plano</Label>
            <Select value={selectedPlanCode} onValueChange={setSelectedPlanCode}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano de destino" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.code !== currentPlanCode && p.status === "active")
                  .map((plan) => (
                    <SelectItem key={plan.code} value={plan.code}>
                      <div className="flex items-center gap-2">
                        <span>{plan.name}</span>
                        {plan.displayOrder >
                          (plans.find((p) => p.code === currentPlanCode)
                            ?.displayOrder ?? 0) && (
                          <Badge variant="secondary" className="text-xs">
                            Upgrade
                          </Badge>
                        )}
                        {plan.displayOrder <
                          (plans.find((p) => p.code === currentPlanCode)
                            ?.displayOrder ?? 0) && (
                          <Badge variant="outline" className="text-xs">
                            Downgrade
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plan Preview */}
          {selectedPlan && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium">{selectedPlan.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedPlan.description}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {selectedPlan.billingInterval === "monthly"
                    ? "Mensal"
                    : selectedPlan.billingInterval === "yearly"
                      ? "Anual"
                      : selectedPlan.billingInterval}
                </Badge>
                {selectedPlan.trialAllowed && (
                  <Badge variant="secondary" className="text-xs">
                    Trial: {selectedPlan.trialDaysDefault ?? 14} dias
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo da Alteração *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo da alteração de plano..."
              rows={3}
            />
          </div>

          {/* Warning for downgrade */}
          {isDowngrade && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Downgrade: Algumas funcionalidades podem ser perdidas. O
                downgrade será aplicado no próximo ciclo de faturamento.
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
            {isUpgrade ? "Aplicar Upgrade" : isDowngrade ? "Agendar Downgrade" : "Alterar Plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
