/**
 * PatternCard
 * ------------
 * Card individual de um padrão APF na Biblioteca.
 * Exibe tipo funcional, complexidade, domínio, taxa de correção
 * e botões de aprovar/rejeitar para status "auto".
 */
import { CheckCircle2, XCircle, Clock, BookOpen, AlertTriangle, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { KnowledgePattern } from "../../services/knowledge.service";

const CORRECTION_REASON_LABELS: Record<string, string> = {
  wrong_functional_type: "Tipo funcional errado",
  wrong_complexity:      "Complexidade errada",
  wrong_pf_value:        "PF calculado errado",
  missing_function:      "Função não identificada",
  extra_function:        "Função extra",
  wrong_boundary:        "Fronteira incorreta",
  wrong_det_count:       "Contagem DET incorreta",
  wrong_ret_count:       "Contagem RET incorreta",
  wrong_ftr_count:       "Contagem FTR incorreta",
  other:                 "Outro motivo",
};

const TYPE_COLORS: Record<string, string> = {
  EE:  "bg-blue-100 text-blue-700 border-blue-200",
  SE:  "bg-purple-100 text-purple-700 border-purple-200",
  CE:  "bg-cyan-100 text-cyan-700 border-cyan-200",
  ALI: "bg-green-100 text-green-700 border-green-200",
  AIE: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  Baixa:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Media:  "bg-amber-50 text-amber-700 border-amber-200",
  Alta:   "bg-red-50 text-red-700 border-red-200",
};

interface Props {
  pattern: KnowledgePattern;
  isUpdating: boolean;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}

export function PatternCard({ pattern, isUpdating, onApprove, onReject }: Props) {
  const typeClass       = TYPE_COLORS[pattern.functional_type] ?? "bg-muted text-muted-foreground border-border";
  const complexityClass = COMPLEXITY_COLORS[pattern.complexity] ?? "bg-muted text-muted-foreground border-border";
  const correctionPct   = Math.round(pattern.correction_rate * 100);
  const reasonLabel     = pattern.top_correction_reason
    ? CORRECTION_REASON_LABELS[pattern.top_correction_reason] ?? pattern.top_correction_reason
    : null;

  return (
    <Card className="border border-border hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Cabeçalho: tipo + complexidade + domínio */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs font-semibold ${typeClass}`}>
              {pattern.functional_type}
            </Badge>
            <Badge variant="outline" className={`text-xs ${complexityClass}`}>
              {pattern.complexity}
            </Badge>
            {pattern.domain && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {pattern.domain}
              </Badge>
            )}
          </div>
          {/* Status badge */}
          {pattern.status === "validated" && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3" /> Validado
            </Badge>
          )}
          {pattern.status === "rejected" && (
            <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] gap-1">
              <XCircle className="h-3 w-3" /> Rejeitado
            </Badge>
          )}
          {pattern.status === "auto" && (
            <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] gap-1">
              <Clock className="h-3 w-3" /> Pendente
            </Badge>
          )}
        </div>

        {/* Chave do padrão */}
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs font-mono text-muted-foreground truncate" title={pattern.pattern_key}>
            {pattern.pattern_key}
          </p>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-muted/40 rounded-md py-2">
            <p className="text-[10px] text-muted-foreground">Ocorrências</p>
            <p className="text-base font-bold tabular-nums">{pattern.occurrence_count}</p>
          </div>
          <div className="text-center bg-muted/40 rounded-md py-2">
            <p className="text-[10px] text-muted-foreground">PF médio</p>
            <p className="text-base font-bold tabular-nums">
              {pattern.avg_pf_bruto != null ? pattern.avg_pf_bruto.toFixed(1) : "—"}
            </p>
          </div>
          <div className={`text-center rounded-md py-2 ${
            correctionPct >= 30 ? "bg-red-50 dark:bg-red-900/10" :
            correctionPct >= 15 ? "bg-amber-50 dark:bg-amber-900/10" :
            "bg-emerald-50 dark:bg-emerald-900/10"
          }`}>
            <p className="text-[10px] text-muted-foreground">Correção</p>
            <p className={`text-base font-bold tabular-nums ${
              correctionPct >= 30 ? "text-red-600" :
              correctionPct >= 15 ? "text-amber-600" :
              "text-emerald-600"
            }`}>{correctionPct}%</p>
          </div>
        </div>

        {/* Motivo de correção mais frequente */}
        {reasonLabel && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Erro mais frequente: <strong>{reasonLabel}</strong></span>
          </div>
        )}

        {/* Botões de ação — só para padrões pendentes */}
        {pattern.status === "auto" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              disabled={isUpdating}
              onClick={() => onApprove(pattern.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Validar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              disabled={isUpdating}
              onClick={() => onReject(pattern.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
