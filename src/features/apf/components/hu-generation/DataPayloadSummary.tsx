import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataPayloadSummaryProps {
  totalChars: number;
  estimatedTokens: number;
  contextLimit: number; // in tokens
}

export function DataPayloadSummary({ totalChars, estimatedTokens, contextLimit }: DataPayloadSummaryProps) {
  const usagePercentage = Math.min(100, (estimatedTokens / contextLimit) * 100);
  const isCritical = usagePercentage > 85;
  const isExceeded = estimatedTokens > contextLimit;

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-colors",
      isExceeded ? "border-destructive bg-destructive/5" :
      isCritical ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10" :
      "border-border bg-muted/20"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className={cn("h-4 w-4", isExceeded ? "text-destructive" : "text-primary")} />
          <h4 className="text-[11px] font-semibold uppercase tracking-wider">Peso do Contexto</h4>
        </div>
        <Badge variant={isExceeded ? "destructive" : isCritical ? "outline" : "secondary"} className="text-[10px]">
          {estimatedTokens.toLocaleString()} / {contextLimit.toLocaleString()} tokens
        </Badge>
      </div>

      <div className="space-y-2">
        <Progress
          value={usagePercentage}
          className="h-2"
          indicatorClassName={cn(
            isExceeded ? "bg-destructive" : isCritical ? "bg-amber-500" : "bg-primary"
          )}
        />

        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted-foreground">Volume de texto: {totalChars.toLocaleString()} caracteres</span>
          <span className={cn("font-medium", isExceeded ? "text-destructive" : isCritical ? "text-amber-500" : "text-muted-foreground")}>
            {usagePercentage.toFixed(1)}% do limite
          </span>
        </div>
      </div>

      {(isCritical || isExceeded) && (
        <div className={cn(
          "mt-3 flex items-start gap-2 p-2 rounded-lg text-[10px] leading-relaxed",
          isExceeded ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        )}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            {isExceeded
              ? "Volume de dados excedido. Considere fragmentar seus arquivos ou mudar para uma IA de contexto longo (como Gemini/Claude)."
              : "Volume de dados alto. A IA pode perder precisão ou falhar se o limite for atingido."}
          </p>
        </div>
      )}
    </div>
  );
}
