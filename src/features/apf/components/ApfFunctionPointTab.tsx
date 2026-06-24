import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { LearningInsightsPanel } from "./learning/LearningInsightsPanel";
import { useLearningInsights } from "../hooks/useLearningInsights";

const CORRECTION_REASONS = [
  { value: "wrong_functional_type", label: "Tipo funcional errado (EE/SE/CE/ALI/AIE)" },
  { value: "wrong_complexity", label: "Complexidade errada (Baixa/Média/Alta)" },
  { value: "wrong_pf_value", label: "Valor de PF calculado errado" },
  { value: "missing_function", label: "Função não identificada pela IA" },
  { value: "extra_function", label: "Função extra (não deveria existir)" },
  { value: "wrong_boundary", label: "Fronteira do sistema incorreta" },
  { value: "wrong_det_count", label: "Contagem de DETs incorreta" },
  { value: "wrong_ret_count", label: "Contagem de RETs incorreta" },
  { value: "wrong_ftr_count", label: "Contagem de FTRs incorreta" },
  { value: "other", label: "Outro motivo" },
] as const;

type CorrectionReason = typeof CORRECTION_REASONS[number]["value"];

interface SprintOption {
  id: string;
  name: string;
  is_active: boolean;
  team_id: string;
}

interface HuRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  story_points: number | null;
  function_points: number | null;
  ai_fp_breakdown: AiBreakdown | null;
  ai_fp_confidence: number | null;
  ai_fp_validated: boolean;
  contract_id: string | null;
  _sessionId?: string;
  _providerUsed?: string;
  _ragWasUsed?: boolean;
  _ragCaseCount?: number;
  _promptVersionHash?: string;
  _rawItems?: any[];
}

interface AiBreakdown {
  EI: number;
  EO: number;
  EQ: number;
  ILF: number;
  EIF: number;
  total: number;
  reasoning?: string;
}

interface FpAnalysis {
  huId: string;
  breakdown: AiBreakdown;
  confidence: number;
  loading: boolean;
  error: string | null;
}

interface ValidationDialog {
  open: boolean;
  hu: HuRow | null;
  fpValue: number;
  correctionReason: CorrectionReason | "";
  correctionNotes: string;
  wasCorrected: boolean;
}

interface CountFunctionPointsResponse {
  success?: boolean;
  analysis_id?: string | null;
  ai_raw_count?: number;
  ai_breakdown?: Partial<AiBreakdown> & { complexity?: string };
  ai_confidence?: number;
  ai_reasoning?: string;
  providerUsed?: string;
  model_used?: string;
  few_shot_examples_used?: number;
  error?: string;
  rawError?: string;
}

function buildStoryText(hu: HuRow): string {
  const parts: string[] = [
    `Código interno: ${hu.code}`,
    `Título: ${hu.title}`,
  ];
  if (hu.description?.trim()) parts.push(`Descrição:\n${hu.description.trim()}`);
  if (hu.acceptance_criteria?.trim()) parts.push(`Critérios de Aceite:\n${hu.acceptance_criteria.trim()}`);
  return parts.join("\n\n");
}

async function resolveActiveProviderId(): Promise<string | null> {
  const { data } = await supabase
    .from("ai_providers" as any)
    .select("id")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

async function getEdgeFunctionErrorMessage(error: any, data?: CountFunctionPointsResponse | null): Promise<string> {
  if (data?.error) return data.error;

  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await response.clone().text();
        if (text?.trim()) return text.trim();
      } catch {
        // Mantém o fallback abaixo.
      }
    }
  }

  return error?.message ?? "Falha ao executar a contagem de Pontos de Função.";
}

function normalizeBreakdown(data: CountFunctionPointsResponse): AiBreakdown {
  const raw = data.ai_breakdown;
  if (!raw || typeof raw !== "object") {
    throw new Error("A função de contagem não retornou o breakdown APF esperado.");
  }

  const EI = Math.max(0, Number(raw.EI ?? 0));
  const EO = Math.max(0, Number(raw.EO ?? 0));
  const EQ = Math.max(0, Number(raw.EQ ?? 0));
  const ILF = Math.max(0, Number(raw.ILF ?? 0));
  const EIF = Math.max(0, Number(raw.EIF ?? 0));
  const calculatedTotal = EI * 3 + EO * 4 + EQ * 3 + ILF * 7 + EIF * 5;
  const total = Number.isFinite(Number(raw.total)) ? Number(raw.total) : calculatedTotal;

  return {
    EI,
    EO,
    EQ,
    ILF,
    EIF,
    total,
    reasoning: String(raw.reasoning ?? data.ai_reasoning ?? ""),
  };
}

export function ApfFunctionPointTab() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [userStories, setUserStories] = useState<HuRow[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, FpAnalysis>>({});
  const [loadingSprints, setLoadingSprints] = useState(true);
  const [loadingHUs, setLoadingHUs] = useState(false);
  const [countingAll, setCountingAll] = useState(false);
  const [teamProjectId, setTeamProjectId] = useState<string | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const [dialog, setDialog] = useState<ValidationDialog>({
    open: false,
    hu: null,
    fpValue: 0,
    correctionReason: "",
    correctionNotes: "",
    wasCorrected: false,
  });

  const {
    insights,
    loading: insightsLoading,
    lastRefresh: insightsRefresh,
    refresh: insightsRefreshFn,
  } = useLearningInsights();

  useEffect(() => {
    resolveActiveProviderId().then(setActiveProviderId);
  }, []);

  useEffect(() => {
    if (!teamId) {
      setTeamProjectId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: contractTeam } = await supabase
        .from("contract_teams")
        .select("contract_id")
        .eq("team_id", teamId)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      let contractId = contractTeam?.contract_id ?? null;
      if (!contractId) {
        const { data: model } = await supabase
          .from("apf_counting_models" as any)
          .select("contract_id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        contractId = (model as any)?.contract_id ?? null;
      }

      if (!contractId) {
        setTeamProjectId(null);
        return;
      }

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("team_id", teamId)
        .eq("contract_id", contractId)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setTeamProjectId((project as any)?.id ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    if (!teamId) {
      setSprints([]);
      setLoadingSprints(false);
      return;
    }

    setLoadingSprints(true);
    supabase
      .from("sprints")
      .select("id, name, is_active, team_id")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const list = (data ?? []) as SprintOption[];
        setSprints(list);
        const active = list.find((s) => s.is_active);
        if (active) setSelectedSprintId(active.id);
        else if (list.length && !selectedSprintId) setSelectedSprintId(list[0].id);
        setLoadingSprints(false);
      });
  }, [teamId]);

  useEffect(() => {
    if (!teamId || !selectedSprintId) {
      setUserStories([]);
      return;
    }

    setLoadingHUs(true);
    supabase
      .from("user_stories")
      .select("id, code, title, description, acceptance_criteria, story_points, function_points, ai_fp_breakdown, ai_fp_confidence, ai_fp_validated, contract_id")
      .eq("team_id", teamId)
      .eq("sprint_id", selectedSprintId)
      .order("code", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          supabase
            .from("user_stories")
            .select("id, code, title, description, acceptance_criteria, story_points, function_points, contract_id")
            .eq("team_id", teamId)
            .eq("sprint_id", selectedSprintId)
            .order("code", { ascending: true })
            .limit(200)
            .then(({ data: fallbackData }) => {
              setUserStories((fallbackData ?? []).map((hu: any) => ({
                ...hu,
                acceptance_criteria: hu.acceptance_criteria ?? null,
                ai_fp_breakdown: null,
                ai_fp_confidence: null,
                ai_fp_validated: false,
                contract_id: hu.contract_id ?? null,
              })));
              setLoadingHUs(false);
            });
          return;
        }

        setUserStories((data ?? []).map((hu: any) => ({
          ...hu,
          acceptance_criteria: hu.acceptance_criteria ?? null,
          ai_fp_breakdown: hu.ai_fp_breakdown ?? null,
          ai_fp_confidence: hu.ai_fp_confidence ?? null,
          ai_fp_validated: hu.ai_fp_validated ?? false,
          contract_id: hu.contract_id ?? null,
        })));
        setLoadingHUs(false);
      });
  }, [teamId, selectedSprintId]);

  const countFpForHu = useCallback(async (hu: HuRow): Promise<boolean> => {
    setAnalyses((previous) => ({
      ...previous,
      [hu.id]: {
        huId: hu.id,
        breakdown: previous[hu.id]?.breakdown ?? ({} as AiBreakdown),
        confidence: 0,
        loading: true,
        error: null,
      },
    }));

    try {
      if (!teamId) throw new Error("Nenhum time foi selecionado para realizar a contagem.");

      const providerId = activeProviderId ?? await resolveActiveProviderId();
      if (!providerId) {
        throw new Error("Nenhum provedor de IA ativo cadastrado. Configure um provider em Configurações → IA.");
      }

      const storyText = buildStoryText(hu);
      const { data, error } = await supabase.functions.invoke<CountFunctionPointsResponse>(
        "count-function-points",
        {
          body: {
            teamId,
            huId: hu.id,
            storyText,
            providerId,
            context: {
              storyPoints: hu.story_points,
              acceptanceCriteria: hu.acceptance_criteria,
            },
          },
        },
      );

      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, data));
      if (!data?.success) throw new Error(data?.error ?? "A contagem de Pontos de Função não foi concluída.");

      const breakdown = normalizeBreakdown(data);
      const totalPf = Number(data.ai_raw_count ?? breakdown.total);
      const confidence = Math.min(1, Math.max(0, Number(data.ai_confidence ?? 0.7)));

      setAnalyses((previous) => ({
        ...previous,
        [hu.id]: {
          huId: hu.id,
          breakdown,
          confidence,
          loading: false,
          error: null,
        },
      }));

      setUserStories((previous) => previous.map((item) =>
        item.id !== hu.id
          ? item
          : {
              ...item,
              function_points: totalPf,
              ai_fp_breakdown: breakdown,
              ai_fp_confidence: confidence,
              _sessionId: data.analysis_id ?? undefined,
              _providerUsed: data.providerUsed ?? undefined,
              _ragWasUsed: false,
              _ragCaseCount: data.few_shot_examples_used ?? 0,
              _rawItems: [],
            },
      ));

      toast.success(`PF calculado para ${hu.code}: ${totalPf} PF`);
      return true;
    } catch (error: any) {
      const message = error?.message ?? "Erro ao calcular PF";
      setAnalyses((previous) => ({
        ...previous,
        [hu.id]: {
          huId: hu.id,
          breakdown: previous[hu.id]?.breakdown ?? ({} as AiBreakdown),
          confidence: previous[hu.id]?.confidence ?? 0,
          loading: false,
          error: message,
        },
      }));
      toast.error(`Erro ao calcular ${hu.code}: ${message}`);
      return false;
    }
  }, [teamId, activeProviderId]);

  const openValidationDialog = useCallback((hu: HuRow, fpValue: number) => {
    const aiTotalPf = hu.ai_fp_breakdown?.total ?? analyses[hu.id]?.breakdown?.total ?? fpValue;
    const wasCorrected = fpValue !== aiTotalPf;
    setDialog({
      open: true,
      hu,
      fpValue,
      correctionReason: "",
      correctionNotes: "",
      wasCorrected,
    });
  }, [analyses]);

  const confirmValidation = useCallback(async () => {
    const { hu, fpValue, correctionReason, correctionNotes, wasCorrected } = dialog;
    if (!hu) return;
    if (wasCorrected && !correctionReason) {
      toast.warning("Selecione o motivo da correção antes de validar.");
      return;
    }

    setValidating(true);
    try {
      const { error: databaseError } = await supabase
        .from("user_stories")
        .update({ function_points: fpValue, ai_fp_validated: true } as any)
        .eq("id", hu.id);
      if (databaseError) throw new Error(databaseError.message);

      const aiBreakdown = hu.ai_fp_breakdown ?? analyses[hu.id]?.breakdown;
      const { error: validationError } = await supabase.functions.invoke("apf-validate", {
        body: {
          session_id: hu._sessionId ?? hu.id,
          project_id: teamProjectId ?? teamId,
          team_id: teamId,
          hu_text: buildStoryText(hu),
          hu_title: hu.title,
          ai_functional_type: "mixed",
          ai_complexity: "mixed",
          ai_pf_bruto: aiBreakdown?.total ?? null,
          ai_confidence_score: hu.ai_fp_confidence ?? analyses[hu.id]?.confidence ?? null,
          ai_reasoning: aiBreakdown?.reasoning ?? null,
          provider_id: null,
          provider_name: hu._providerUsed ?? null,
          prompt_version_hash: hu._promptVersionHash ?? null,
          rag_was_used: hu._ragWasUsed ?? false,
          rag_case_count: hu._ragCaseCount ?? 0,
          validated_functional_type: "mixed",
          validated_complexity: "mixed",
          validated_pf_bruto: fpValue,
          correction_reason_code: wasCorrected ? correctionReason : undefined,
          correction_notes: correctionNotes || undefined,
        },
      });
      if (validationError) console.warn("apf-validate não persistido:", validationError.message);

      setUserStories((previous) => previous.map((item) =>
        item.id === hu.id
          ? { ...item, function_points: fpValue, ai_fp_validated: true }
          : item,
      ));
      setDialog((current) => ({ ...current, open: false }));
      toast.success(`${hu.code} — ${fpValue} PF validado!`);
      insightsRefreshFn();
    } catch (error: any) {
      toast.error("Erro ao validar", { description: error?.message });
    } finally {
      setValidating(false);
    }
  }, [dialog, analyses, teamId, teamProjectId, insightsRefreshFn]);

  const countAllPending = useCallback(async () => {
    const pending = userStories.filter((hu) => !hu.function_points && !hu.ai_fp_validated);
    if (!pending.length) {
      toast.info("Todas as HUs já possuem PF calculado.");
      return;
    }

    setCountingAll(true);
    try {
      let successCount = 0;
      const failures: string[] = [];

      for (const hu of pending) {
        const success = await countFpForHu(hu);
        if (success) successCount += 1;
        else failures.push(hu.code);
      }

      if (failures.length === 0) {
        toast.success(`Contagem concluída para ${successCount} HU(s)!`);
      } else {
        toast.warning(`Contagem finalizada: ${successCount} sucesso(s) e ${failures.length} falha(s).`, {
          description: `Falharam: ${failures.join(", ")}`,
        });
      }
    } finally {
      setCountingAll(false);
    }
  }, [userStories, countFpForHu]);

  const totalFp = userStories.reduce((total, hu) => total + (hu.function_points ?? 0), 0);
  const validatedCount = userStories.filter((hu) => hu.ai_fp_validated).length;
  const pendingCount = userStories.filter((hu) => !hu.function_points).length;

  if (loadingSprints) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LearningInsightsPanel
        insights={insights}
        loading={insightsLoading}
        lastRefresh={insightsRefresh}
        onRefresh={insightsRefreshFn}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecione uma sprint..." />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  <span className="flex items-center gap-2">
                    {sprint.is_active && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                    {sprint.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSprintId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const sprintId = selectedSprintId;
                setSelectedSprintId("");
                setTimeout(() => setSelectedSprintId(sprintId), 50);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {userStories.length > 0 && (
          <Button
            size="sm"
            onClick={countAllPending}
            disabled={countingAll || pendingCount === 0}
            className="gap-2 shrink-0"
          >
            {countingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Calcular PF pendentes ({pendingCount})
          </Button>
        )}
      </div>

      {userStories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total HUs", value: userStories.length, color: "text-foreground" },
            { label: "Total PF", value: totalFp.toFixed(1), color: "text-primary" },
            { label: "Validados", value: validatedCount, color: "text-emerald-600" },
            { label: "Pendentes", value: pendingCount, color: "text-amber-600" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loadingHUs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : userStories.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {selectedSprintId ? "Nenhuma HU encontrada nesta sprint." : "Selecione uma sprint para iniciar."}
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Histórias de Usuário — Contagem APF por IA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-12 text-center">SP</TableHead>
                  <TableHead className="w-20 text-center">PF IA</TableHead>
                  <TableHead className="w-28 text-center">Breakdown</TableHead>
                  <TableHead className="w-24 text-center">Confiança</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-24 text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStories.map((hu) => {
                  const analysis = analyses[hu.id];
                  const fpValue = hu.function_points ?? analysis?.breakdown?.total;
                  const confidence = hu.ai_fp_confidence ?? analysis?.confidence;
                  const breakdown = hu.ai_fp_breakdown ?? analysis?.breakdown;
                  const isLoading = analysis?.loading ?? false;
                  const hasError = Boolean(analysis?.error);

                  return (
                    <TableRow key={hu.id}>
                      <TableCell className="font-mono text-xs">{hu.code}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{hu.title}</span>
                          {hu.acceptance_criteria && (
                            <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1 text-emerald-600 border-emerald-300">
                              CA
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{hu.story_points ?? 0}</TableCell>
                      <TableCell className="text-center font-semibold text-primary">
                        {isLoading
                          ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          : fpValue ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {breakdown ? (
                          <Badge variant="outline" className="text-xs">
                            {Object.entries(breakdown)
                              .filter(([key, value]) => key !== "total" && key !== "reasoning" && typeof value === "number" && value > 0)
                              .map(([key, value]) => `${key}:${value}`)
                              .join(" ")}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {confidence != null ? (
                          <Badge
                            variant="outline"
                            className={confidence >= 0.7
                              ? "text-emerald-600 border-emerald-300"
                              : "text-amber-600 border-amber-300"}
                          >
                            {Math.round(confidence * 100)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {hu.ai_fp_validated ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Validado
                          </Badge>
                        ) : hasError ? (
                          <Badge variant="destructive" className="gap-1" title={analysis?.error ?? undefined}>
                            <AlertCircle className="h-3 w-3" /> Erro
                          </Badge>
                        ) : fpValue != null ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">Calculado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Não calculado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hu.ai_fp_validated ? (
                          <Button size="sm" variant="ghost" onClick={() => countFpForHu(hu)} disabled={isLoading}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Recalc
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => fpValue != null ? openValidationDialog(hu, fpValue) : countFpForHu(hu)}
                            disabled={isLoading}
                          >
                            {fpValue != null
                              ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Validar</>
                              : <><Sparkles className="h-3 w-3 mr-1" /> Calcular</>}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => !validating && setDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Validar contagem — {dialog.hu?.code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 border border-border px-4 py-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PF sugerido pela IA</span>
                <span className="font-semibold">
                  {dialog.hu?.ai_fp_breakdown?.total ?? dialog.hu?.function_points ?? "—"} PF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PF a validar</span>
                <span className="font-bold text-primary">{dialog.fpValue} PF</span>
              </div>
            </div>

            {dialog.wasCorrected && (
              <>
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Você alterou o PF sugerido pela IA. Selecione o motivo principal para treinar o modelo.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Motivo da correção <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={dialog.correctionReason}
                    onValueChange={(value) => setDialog((current) => ({
                      ...current,
                      correctionReason: value as CorrectionReason,
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CORRECTION_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Observações (opcional)</Label>
                  <Textarea
                    placeholder="Descreva brevemente o que a IA errou..."
                    className="text-sm resize-none h-20"
                    value={dialog.correctionNotes}
                    onChange={(event) => setDialog((current) => ({
                      ...current,
                      correctionNotes: event.target.value,
                    }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialog((current) => ({ ...current, open: false }))}
              disabled={validating}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmValidation}
              disabled={validating || (dialog.wasCorrected && !dialog.correctionReason)}
              className="gap-2"
            >
              {validating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              Confirmar validação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
