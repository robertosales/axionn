import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Zap } from "lucide-react";
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
      "p-6 rounded-2xl border-2 transition-all duration-500",
      isExceeded ? "border-destructive bg-destructive/[0.03] shadow-lg shadow-destructive/5" :
      isCritical ? "border-amber-500/50 bg-amber-500/[0.02]" :
      "border-border bg-muted/20"
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isExceeded ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}>
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">Saturação de Contexto</h4>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
              Cálculo em tempo real (Tokens)
            </p>
          </div>
        </div>
        <Badge
          variant={isExceeded ? "destructive" : isCritical ? "outline" : "secondary"}
          className="text-[10px] font-black tracking-tight px-3 py-1"
        >
          {estimatedTokens.toLocaleString()} / {contextLimit.toLocaleString()}
        </Badge>
      </div>

      <div className="space-y-3">
        <Progress
          value={usagePercentage}
          className="h-2.5 bg-muted border border-border"
          indicatorClassName={cn(
            "transition-all duration-1000 ease-out",
            isExceeded ? "bg-destructive" : isCritical ? "bg-amber-500" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
          )}
        />

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              Total Processado: <span className="text-foreground">{totalChars.toLocaleString()} chars</span>
            </span>
          </div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-tighter",
            isExceeded ? "text-destructive" : isCritical ? "text-amber-500" : "text-primary"
          )}>
            {usagePercentage.toFixed(1)}% Consumido
          </span>
        </div>
      </div>

      {(isCritical || isExceeded) && (
        <div className={cn(
          "mt-6 flex items-start gap-3 p-4 rounded-xl text-[11px] font-medium leading-relaxed animate-in slide-in-from-top-2 duration-300",
          isExceeded ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
        )}>
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {isExceeded
              ? "Volume de dados muito alto. Considere fragmentar seus arquivos ou mudar para uma IA de contexto longo (como Gemini/Claude)."
              : "Volume de dados alto. A IA pode perder precisão ou ignorar detalhes se o limite for atingido."}
          </p>
        </div>
      )}
    </div>
  );
}
