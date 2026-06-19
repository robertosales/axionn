/**
 * PredictionWidget
 * -----------------
 * Card de estimativa preditiva.
 * Input: SP planejados → Output: PF estimado + intervalo de confiança.
 * Inclui gauge visual de qualidade do modelo.
 */
import { useState } from "react";
import { TrendingUp, Sparkles, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { PredictionResult } from "../../services/predictive.service";

const QUALITY_CONFIG = {
  excellent:    { label: "Excelente",   color: "text-emerald-600", badge: "border-emerald-400 text-emerald-600", bar: "bg-emerald-500" },
  good:         { label: "Bom",         color: "text-blue-600",    badge: "border-blue-400 text-blue-600",       bar: "bg-blue-500"    },
  weak:         { label: "Fraco",       color: "text-amber-600",   badge: "border-amber-400 text-amber-600",     bar: "bg-amber-500"   },
  insufficient: { label: "Insuficiente",color: "text-muted-foreground", badge: "", bar: "bg-muted" },
};

interface Props {
  prediction: PredictionResult | null;
  inputSp: number;
  onInputSpChange: (sp: number) => void;
  sampleSize: number;
}

export function PredictionWidget({ prediction, inputSp, onInputSpChange, sampleSize }: Props) {
  const quality  = prediction ? QUALITY_CONFIG[prediction.modelQuality] : null;
  const r2Pct    = prediction ? Math.round(prediction.r2 * 100) : 0;

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/3 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Estimativa Preditiva
          {prediction && (
            <Badge variant="outline" className={`text-[10px] ml-auto ${quality?.badge}`}>
              Modelo {quality?.label} (R²={prediction.r2})
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Input SP */}
        <div className="space-y-2">
          <Label className="text-xs">Story Points planejados para a próxima sprint</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={10} max={300} step={5}
              value={[inputSp]}
              onValueChange={([v]) => onInputSpChange(v)}
              className="flex-1"
            />
            <Input
              type="number" min={1} max={999}
              value={inputSp}
              onChange={(e) => onInputSpChange(Number(e.target.value) || 1)}
              className="w-20 h-8 text-sm text-center"
            />
            <span className="text-xs text-muted-foreground w-4">SP</span>
          </div>
        </div>

        {sampleSize < 2 ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Dados insuficientes. São necessárias ao menos 2 sprints com PF calculados para gerar a estimativa.
            </p>
          </div>
        ) : prediction ? (
          <>
            {/* Resultado principal */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 rounded-xl bg-primary/8 border border-primary/20 p-4 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">PF Estimado</p>
                <p className="text-3xl font-bold text-primary tabular-nums">{prediction.estimatedPf}</p>
                <p className="text-[10px] text-muted-foreground mt-1">pontos de função</p>
              </div>
              <div className="col-span-2 space-y-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Intervalo de confiança (80%)</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {prediction.ci80Low} — {prediction.ci80High} PF
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Taxa PF/SP do modelo</p>
                  <p className="text-sm font-semibold tabular-nums">{prediction.slope.toFixed(2)} PF por SP</p>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Amostra</p>
                  <p className="text-sm font-semibold tabular-nums">{prediction.sampleSize} sprints históricas</p>
                </div>
              </div>
            </div>

            {/* Barra de qualidade R² */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">Qualidade do modelo (R²)</p>
                <p className="text-[10px] font-semibold">{r2Pct}%</p>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${quality?.bar}`}
                  style={{ width: `${r2Pct}%` }}
                />
              </div>
            </div>

            {prediction.modelQuality === "weak" && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 dark:bg-amber-900/10">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  O modelo está com R² baixo. Adicione mais sprints com PF validado para melhorar a precisão.
                </p>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
