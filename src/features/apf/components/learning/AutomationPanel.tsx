/**
 * AutomationPanel
 * ----------------
 * Painel de configuração de automação progressiva (Stage 5).
 * Controla:
 *   - Toggle de auto-aprovação
 *   - Sliders de critérios (min ocorrências, max taxa correção)
 *   - Toggle de alerta de drift + threshold
 *   - Botão de execução manual de auto-aprovação
 *   - Preview de quantos padrões seriam aprovados
 */
import { Zap, Settings2, CheckCircle2, Play, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { AutomationConfig } from "../../services/automation.service";

interface Props {
  config: AutomationConfig;
  onConfigChange: (partial: Partial<AutomationConfig>) => void;
  candidateCount: number;
  running: boolean;
  lastRun: Date | null;
  onRunNow: () => void;
}

export function AutomationPanel({
  config,
  onConfigChange,
  candidateCount,
  running,
  lastRun,
  onRunNow,
}: Props) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Automação Progressiva
          {config.autoApproveEnabled && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              <Zap className="h-2.5 w-2.5 mr-1" /> Ativa
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-5">
        {/* ── Auto-aprovação ────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Auto-aprovação de padrões</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Padrões que atendem os critérios são validados automaticamente
              </p>
            </div>
            <Switch
              checked={config.autoApproveEnabled}
              onCheckedChange={(v) => onConfigChange({ autoApproveEnabled: v })}
            />
          </div>

          {/* Min ocorrências */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Mínimo de ocorrências</Label>
              <span className="text-xs font-bold tabular-nums">{config.minOccurrences}</span>
            </div>
            <Slider
              min={3}
              max={50}
              step={1}
              value={[config.minOccurrences]}
              onValueChange={([v]) => onConfigChange({ minOccurrences: v })}
              disabled={!config.autoApproveEnabled}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>3 (mais agressivo)</span>
              <span>50 (mais conservador)</span>
            </div>
          </div>

          {/* Max taxa correção */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Taxa máxima de correção</Label>
              <span className="text-xs font-bold tabular-nums">
                {Math.round(config.maxCorrectionRate * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={30}
              step={1}
              value={[Math.round(config.maxCorrectionRate * 100)]}
              onValueChange={([v]) => onConfigChange({ maxCorrectionRate: v / 100 })}
              disabled={!config.autoApproveEnabled}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0% (só perfeitos)</span>
              <span>30% (mais flexível)</span>
            </div>
          </div>

          {/* Preview de candidatos */}
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
            candidateCount > 0
              ? "bg-primary/5 border border-primary/20 text-primary"
              : "bg-muted/40 border border-border text-muted-foreground"
          }`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {candidateCount > 0
              ? <span><strong>{candidateCount}</strong> padrão{candidateCount !== 1 ? "s" : ""} seriam aprovados com a configuração atual</span>
              : <span>Nenhum padrão atende os critérios atuais</span>
            }
          </div>

          {/* Botão executar agora */}
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={!config.autoApproveEnabled || candidateCount === 0 || running}
            onClick={onRunNow}
          >
            <Play className={`h-3.5 w-3.5 ${running ? "animate-pulse" : ""}`} />
            {running ? "Executando..." : "Executar auto-aprovação agora"}
          </Button>

          {lastRun && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última execução: {lastRun.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>

        <div className="border-t border-border" />

        {/* ── Alerta de Drift ───────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Alerta de queda de acurácia</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Notifica quando a acurácia semanal cai além do limite
              </p>
            </div>
            <Switch
              checked={config.driftAlertEnabled}
              onCheckedChange={(v) => onConfigChange({ driftAlertEnabled: v })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Threshold de alerta</Label>
              <span className="text-xs font-bold tabular-nums">-{config.driftThresholdPp} pp</span>
            </div>
            <Slider
              min={3}
              max={30}
              step={1}
              value={[config.driftThresholdPp]}
              onValueChange={([v]) => onConfigChange({ driftThresholdPp: v })}
              disabled={!config.driftAlertEnabled}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>-3 pp (sensível)</span>
              <span>-30 pp (tolerante)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
