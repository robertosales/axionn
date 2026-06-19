/**
 * ApfFunctionPointTab (v3 — Fase 4)
 * ------------------------------------
 * Integra o Aprendizado Bidirecional:
 *  - Carrega insights com useLearningInsights
 *  - Exibe LearningInsightsPanel no topo
 *  - validateFp: agora chama saveValidation() do learning.service
 *    para persistir o desvio e alimentar a calibração
 *  - countFpForHu: passa calibrationContext do AiPipelineContext para
 *    a Edge Function, que injeta antes do prompt de contagem
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiPipeline } from "../contexts/AiPipelineContext";
import { useLearningInsights } from "../hooks/useLearningInsights";
import { saveValidation } from "../services/learning.service";
import { LearningInsightsPanel } from "./learning/LearningInsightsPanel";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Info,
} from "lucide-react";

interface SprintOption  { id: string; name: string; is_active: boolean; }
interface HuRow {
  id: string; code: string; title: string;
  description: string | null; story_points: number | null;
  function_points: number | null; ai_fp_breakdown: AiBreakdown | null;
  ai_fp_confidence: number | null; ai_fp_validated: boolean;
}
interface AiBreakdown {
  EI: number; EO: number; EQ: number; ILF: number; EIF: number;
  total: number; reasoning?: string;
}
interface FpAnalysis {
  huId: string; breakdown: AiBreakdown; confidence: number;
  loading: boolean; error: string | null;
}

export function ApfFunctionPointTab() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const {
    activePipelineSprintId,
    setActivePipelineSprintId,
    lastHuGenerationId,
    setLastPfAnalysisId,
    getAiPayload,
    isCalibrated,
  } = useAiPipeline();

  // Fase 4: insights de aprendizado
  const { insights, loading: loadingInsights, lastRefresh, refresh: refreshInsights } = useLearningInsights();

  const [sprints, setSprints]           = useState<SprintOption[]>([]);
  const [userStories, setUserStories]   = useState<HuRow[]>([]);
  const [analyses, setAnalyses]         = useState<Record<string, FpAnalysis>>({});
  const [loadingSprints, setLoadingSprints] = useState(true);
  const [loadingHUs, setLoadingHUs]     = useState(false);
  const [countingAll, setCountingAll]   = useState(false);

  const selectedSprintId    = activePipelineSprintId;
  const setSelectedSprintId = setActivePipelineSprintId;

  useEffect(() => {
    if (!teamId) return;
    setLoadingSprints(true);
    supabase
      .from("sprints")
      .select("id, name, is_active")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const list = (data ?? []) as SprintOption[];
        setSprints(list);
        if (!activePipelineSprintId) {
          const active = list.find((s) => s.is_active);
          if (active) setSelectedSprintId(active.id);
        }
        setLoadingSprints(false);
      });
  }, [teamId]);

  useEffect(() => {
    if (!teamId || !selectedSprintId) { setUserStories([]); return; }
    setLoadingHUs(true);
    supabase
      .from("user_stories")
      .select("id, code, title, description, story_points, function_points, ai_fp_breakdown, ai_fp_confidence, ai_fp_validated")
      .eq("team_id", teamId)
      .eq("sprint_id", selectedSprintId)
      .order("code", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          supabase
            .from("user_stories")
            .select("id, code, title, description, story_points, function_points")
            .eq("team_id", teamId)
            .eq("sprint_id", selectedSprintId)
            .order("code", { ascending: true })
            .limit(200)
            .then(({ data: fb }) => {
              setUserStories((fb ?? []).map((h: any) => ({ ...h, ai_fp_breakdown: null, ai_fp_confidence: null, ai_fp_validated: false })));
              setLoadingHUs(false);
            });
          return;
        }
        setUserStories((data ?? []).map((h: any) => ({
          ...h,
          ai_fp_breakdown: h.ai_fp_breakdown ?? null,
          ai_fp_confidence: h.ai_fp_confidence ?? null,
          ai_fp_validated: h.ai_fp_validated ?? false,
        })));
        setLoadingHUs(false);
      });
  }, [teamId, selectedSprintId]);

  // Fase 4: calibrationContext é passado para a Edge Function
  const countFpForHu = useCallback(async (hu: HuRow) => {
    setAnalyses((prev) => ({
      ...prev,
      [hu.id]: { huId: hu.id, breakdown: prev[hu.id]?.breakdown ?? {} as AiBreakdown, confidence: 0, loading: true, error: null },
    }));

    try {
      const aiPayload = getAiPayload(); // já inclui calibrationContext (Fase 4)

      const { data, error } = await supabase.functions.invoke("count-function-points", {
        body: {
          teamId,
          huId:      hu.id,
          storyText: [hu.title, hu.description].filter(Boolean).join("\n\n"),
          context: {
            storyPoints:         hu.story_points ?? null,
            acceptanceCriteria:  null,
            storyType:           null,
          },
          providerId: aiPayload.providerId,
        },
      });

      if (error) throw new Error(error.message);

      const result = data as { analysis_id: string; breakdown: AiBreakdown; confidence: number; total_pf: number };
      if (result.analysis_id) setLastPfAnalysisId(result.analysis_id);

      setAnalyses((prev) => ({
        ...prev,
        [hu.id]: { huId: hu.id, breakdown: result.breakdown, confidence: result.confidence, loading: false, error: null },
      }));
      setUserStories((prev) =>
        prev.map((h) =>
          h.id === hu.id
            ? { ...h, function_points: result.total_pf, ai_fp_breakdown: result.breakdown, ai_fp_confidence: result.confidence }
            : h
        )
      );
      toast.success(`PF calculado para ${hu.code}: ${result.total_pf} PF${isCalibrated ? " 🧠" : ""}`);
    } catch (err: any) {
      setAnalyses((prev) => ({ ...prev, [hu.id]: { ...prev[hu.id], loading: false, error: err?.message ?? "Erro" } }));
      toast.error(`Erro ao calcular ${hu.code}: ${err?.message ?? "tente novamente"}`);
    }
  }, [teamId, selectedSprintId, getAiPayload, setLastPfAnalysisId, isCalibrated]);

  // Fase 4: validateFp agora persiste desvio no learning.service
  const validateFp = useCallback(async (hu: HuRow, fpValue: number) => {
    const aiPf = hu.function_points ?? fpValue;

    // Persiste validação + desvio para o aprendizado
    await saveValidation({
      teamId,
      storyId:          hu.id,
      storyCode:        hu.code,
      storyTitle:       hu.title,
      sprintId:         selectedSprintId,
      aiTotalPf:        aiPf,
      validatedTotalPf: fpValue,
      breakdown:        hu.ai_fp_breakdown as unknown as Record<string, number> | null,
      confidence:       hu.ai_fp_confidence,
    });

    // Atualiza user_stories
    const { error } = await supabase
      .from("user_stories")
      .update({ function_points: fpValue, ai_fp_validated: true } as any)
      .eq("id", hu.id);

    if (error) { toast.error("Erro ao salvar validação"); return; }

    setUserStories((prev) =>
      prev.map((h) => h.id === hu.id ? { ...h, function_points: fpValue, ai_fp_validated: true } : h)
    );

    // Recarrega insights após validação
    refreshInsights();

    toast.success(`${hu.code} — ${fpValue} PF validado! 🧠 Calibração atualizada.`);
  }, [teamId, selectedSprintId, refreshInsights]);

  const countAllPending = useCallback(async () => {
    const pending = userStories.filter((h) => !h.function_points && !h.ai_fp_validated);
    if (pending.length === 0) { toast.info("Todas as HUs já possuem PF calculado."); return; }
    setCountingAll(true);
    for (const hu of pending) await countFpForHu(hu);
    setCountingAll(false);
    toast.success(`Contagem concluída para ${pending.length} HU(s)!`);
  }, [userStories, countFpForHu]);

  const totalFp        = userStories.reduce((acc, h) => acc + (h.function_points ?? 0), 0);
  const validatedCount = userStories.filter((h) => h.ai_fp_validated).length;
  const pendingCount   = userStories.filter((h) => !h.function_points).length;

  if (loadingSprints) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Fase 4: Painel de Aprendizado Bidirecional */}
      <LearningInsightsPanel
        insights={insights}
        loading={loadingInsights}
        lastRefresh={lastRefresh}
        onRefresh={refreshInsights}
      />

      {/* Banner HU recém-gerada */}
      {lastHuGenerationId && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-primary flex-1">
            HUs recém-geradas nesta sprint — clique em <strong>Calcular PF pendentes</strong> para contar automaticamente{isCalibrated ? " com calibração ativa 🧠" : ""}.
          </p>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </div>
      )}

      {/* Seletor de Sprint + ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecione uma sprint..." />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    {s.is_active && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSprintId && (
            <Button size="sm" variant="outline"
              onClick={() => { setSelectedSprintId(""); setTimeout(() => setSelectedSprintId(selectedSprintId), 50); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        {userStories.length > 0 && (
          <Button size="sm" onClick={countAllPending} disabled={countingAll || pendingCount === 0} className="gap-2 shrink-0">
            {countingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Calcular PF pendentes ({pendingCount}){isCalibrated && " 🧠"}
          </Button>
        )}
      </div>

      {/* KPIs */}
      {userStories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total HUs",  value: userStories.length, color: "text-foreground" },
            { label: "Total PF",   value: totalFp.toFixed(1), color: "text-primary" },
            { label: "Validados",  value: validatedCount,     color: "text-emerald-600" },
            { label: "Pendentes",  value: pendingCount,       color: "text-amber-600" },
          ].map((kpi) => (
            <Card key={kpi.label} className="border border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela */}
      {!selectedSprintId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Selecione uma sprint para ver as HUs e calcular os Pontos de Função.</p>
          </CardContent>
        </Card>
      ) : loadingHUs ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : userStories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhuma HU encontrada nesta sprint.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Histórias de Usuário — Contagem APF por IA
              {isCalibrated && (
                <span className="ml-2 text-primary text-xs">🧠 Calibração ativa</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-16 text-center">SP</TableHead>
                    <TableHead className="w-20 text-center">PF IA</TableHead>
                    <TableHead className="w-28 text-center">Breakdown</TableHead>
                    <TableHead className="w-24 text-center">Confiança</TableHead>
                    <TableHead className="w-28 text-center">Status</TableHead>
                    <TableHead className="w-32 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStories.map((hu) => {
                    const analysis    = analyses[hu.id];
                    const breakdown   = analysis?.breakdown ?? hu.ai_fp_breakdown;
                    const confidence  = analysis?.confidence ?? hu.ai_fp_confidence;
                    const fp          = hu.function_points;
                    const isLoading   = analysis?.loading;
                    const hasError    = analysis?.error;
                    return (
                      <TableRow key={hu.id}>
                        <TableCell><span className="font-mono text-xs text-muted-foreground">{hu.code}</span></TableCell>
                        <TableCell><span className="text-sm line-clamp-2">{hu.title}</span></TableCell>
                        <TableCell className="text-center"><span className="text-sm tabular-nums">{hu.story_points ?? "—"}</span></TableCell>
                        <TableCell className="text-center">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : fp != null ? (
                            <span className="font-semibold tabular-nums text-primary">{fp}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {breakdown ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {Object.entries(breakdown)
                                .filter(([k]) => ["EI","EO","EQ","ILF","EIF"].includes(k))
                                .map(([k, v]) =>
                                  (v as number) > 0 ? (
                                    <span key={k} className="text-[10px] bg-muted px-1 rounded font-mono">{k}:{v}</span>
                                  ) : null
                                )}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {confidence != null ? (
                            <Badge variant="outline" className={
                              confidence >= 0.8 ? "border-emerald-500 text-emerald-600"
                              : confidence >= 0.6 ? "border-amber-500 text-amber-600"
                              : "border-red-400 text-red-500"
                            }>
                              {Math.round(confidence * 100)}%
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {hu.ai_fp_validated ? (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Validado
                            </Badge>
                          ) : fp != null ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">Pendente</Badge>
                          ) : hasError ? (
                            <Badge variant="outline" className="border-red-400 text-red-500 gap-1">
                              <AlertCircle className="h-3 w-3" /> Erro
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Não calculado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isLoading && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
                                onClick={() => countFpForHu(hu)}>
                                <Sparkles className="h-3 w-3" />
                                {fp != null ? "Recalc" : "Calcular"}
                              </Button>
                            )}
                            {fp != null && !hu.ai_fp_validated && (
                              <Button size="sm" variant="ghost"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 gap-1"
                                onClick={() => validateFp(hu, fp)}>
                                <CheckCircle2 className="h-3 w-3" /> Validar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
