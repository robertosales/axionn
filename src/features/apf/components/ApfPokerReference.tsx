import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, FileText, ChevronRight, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { getSizeByPoints } from "@/lib/sizeReference";
import { getGenerationDownloadUrl } from "@/features/apf/services/apf.service";
import { toast } from "sonner";

const DEFAULT_PF_TO_SP = 0.5;

interface ApfPokerReferenceProps {
  open: boolean;
  onClose: () => void;
  huId: string;
  huCode: string;
  huTitle: string;
  onApplyEstimate: (sizeKey: string, hours: number, storyPoints: number, source: string) => void;
}

interface ApfEntry {
  id: string;
  sprintName: string;
  templateName: string;
  generatedAt: string;
  pfTotal: number | null;
  pfBreakdown: Record<string, number> | null;
  outputFilename: string;
  storagePath: string | null;
}

export function ApfPokerReference({
  open,
  onClose,
  huId,
  huCode,
  huTitle,
  onApplyEstimate,
}: ApfPokerReferenceProps) {
  const { currentTeamId } = useAuth();
  const { activeSprint } = useSprint();
  const [entries, setEntries] = useState<ApfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversionFactor, setConversionFactor] = useState(DEFAULT_PF_TO_SP);

  useEffect(() => {
    if (!open || !currentTeamId || !activeSprint) return;
    setLoading(true);
    supabase
      .from("apf_generations")
      .select(
        "id, sprint_id, template_id, output_filename, storage_path, pf_total, pf_breakdown, created_at, sprints(name), apf_templates(name)"
      )
      .eq("team_id", currentTeamId)
      .eq("sprint_id", activeSprint.id)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setEntries(
            data.map((d: any) => ({
              id: d.id,
              sprintName: d.sprints?.name ?? "",
              templateName: d.apf_templates?.name ?? "Sem template",
              generatedAt: new Date(d.created_at).toLocaleDateString("pt-BR"),
              pfTotal: d.pf_total ?? null,
              pfBreakdown: d.pf_breakdown ?? null,
              outputFilename: d.output_filename ?? "Evidencia_APF.docx",
              storagePath: d.storage_path ?? null,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, currentTeamId, activeSprint]);

  const computedSp = (pfTotal: number) => Math.max(1, Math.round(pfTotal * conversionFactor));

  const handleApply = (entry: ApfEntry) => {
    const pf = entry.pfTotal ?? 0;
    const sp = pf > 0 ? computedSp(pf) : 1;
    const size = getSizeByPoints(sp);
    if (!size) {
      toast.error("Não foi possível mapear o SP para um tamanho. Ajuste o fator de conversão.");
      return;
    }
    onApplyEstimate(size.key, size.hours, sp, `APF: ${entry.templateName} (${entry.generatedAt})`);
    toast.success(`Estimativa APF aplicada: ${size.key} — ${size.hours}h (${sp} SP)`);
    onClose();
  };

  const handleDownload = async (entry: ApfEntry) => {
    if (!entry.storagePath) {
      toast.error("Arquivo não disponível no Storage para esta geração.");
      return;
    }
    try {
      const url = await getGenerationDownloadUrl(entry.storagePath);
      if (!url) throw new Error("URL não gerada");
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.outputFilename;
      a.click();
    } catch {
      toast.error("Erro ao gerar link de download. Tente novamente.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Referência APF para esta HU
          </SheetTitle>
          <SheetDescription className="text-xs">
            <Badge variant="outline" className="font-mono text-[10px] mr-1.5">{huCode}</Badge>
            {huTitle}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-3" />

        {/* Fator de conversão */}
        <div className="shrink-0 rounded-lg border bg-muted/40 p-3 space-y-1.5">
          <p className="text-xs font-semibold">Fator de conversão: PF → Story Points</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={conversionFactor}
              onChange={(e) => setConversionFactor(parseFloat(e.target.value) || DEFAULT_PF_TO_SP)}
              className="w-20 h-7 text-xs text-center rounded border bg-background px-2"
            />
            <span className="text-xs text-muted-foreground">SP por Ponto de Função</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ex.: 10 PF × {conversionFactor} = {Math.round(10 * conversionFactor)} SP
            → {getSizeByPoints(Math.round(10 * conversionFactor))?.key ?? "?"}
            &nbsp;({getSizeByPoints(Math.round(10 * conversionFactor))?.hours ?? "?"}h)
          </p>
        </div>

        <ScrollArea className="flex-1 mt-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma geração APF encontrada</p>
              <p className="text-xs text-muted-foreground/70">
                Gere um documento APF para esta sprint em
                <br />/sala-agil/gerador-apf
              </p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-3 pr-1">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                {entries.length} geração(es) APF nesta sprint
              </p>
              {entries.map((entry) => {
                const pf = entry.pfTotal;
                const sp = pf != null && pf > 0 ? computedSp(pf) : null;
                const size = sp ? getSizeByPoints(sp) : null;
                const canApply = pf != null && pf > 0;

                return (
                  <div key={entry.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="text-xs font-semibold truncate">{entry.templateName}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Gerado em {entry.generatedAt} · {entry.outputFilename}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {size && (
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                            {size.key}
                          </Badge>
                        )}
                        {entry.storagePath && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Baixar documento"
                            onClick={() => handleDownload(entry)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {pf != null ? (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">PF Total:</span>
                        <span className="font-semibold">{pf}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{sp} SP</span>
                        {size && (
                          <>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold text-success">{size.hours}h</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-600 italic">
                        PF não extraído — gere novamente com o baseline para obter o valor automático.
                      </p>
                    )}

                    <Button
                      size="sm"
                      className="w-full gap-1.5 text-xs h-7"
                      onClick={() => handleApply(entry)}
                      disabled={!canApply}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {canApply
                        ? `Usar como referência — ${size?.key ?? "?"} (${size?.hours ?? "?"}h)`
                        : "Nenhum PF disponível para esta geração"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
