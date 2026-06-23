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

// ── Constantes ──────────────────────────────────────────────────────────────
const CORRECTION_REASONS = [
  { value: "wrong_functional_type",  label: "Tipo funcional errado (EE/SE/CE/ALI/AIE)" },
  { value: "wrong_complexity",       label: "Complexidade errada (Baixa/Média/Alta)" },
  { value: "wrong_pf_value",         label: "Valor de PF calculado errado" },
  { value: "missing_function",       label: "Função não identificada pela IA" },
  { value: "extra_function",         label: "Função extra (não deveria existir)" },
  { value: "wrong_boundary",         label: "Fronteira do sistema incorreta" },
  { value: "wrong_det_count",        label: "Contagem de DETs incorreta" },
  { value: "wrong_ret_count",        label: "Contagem de RETs incorreta" },
  { value: "wrong_ftr_count",        label: "Contagem de FTRs incorreta" },
  { value: "other",                  label: "Outro motivo" },
] as const;

type CorrectionReason = typeof CORRECTION_REASONS[number]["value"];

// ── Tipos ────────────────────────────────────────────────────────────────────
interface SprintOption {
  id: string;
  name: string;
  is_active: boolean;
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
  // metadados RAG armazenados após countFpForHu
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

// Estado do diálogo de validação
interface ValidationDialog {
  open: boolean;
  hu: HuRow | null;
  fpValue: number;
  correctionReason: CorrectionReason | "";
  correctionNotes: string;
  wasCorrected: boolean;
}

// ── Helper ───────────────────────────────────────────────────────────────────
function buildStoryText(hu: HuRow): string {
  const parts: string[] = [`Título: ${hu.title}`];
  if (hu.description?.trim()) parts.push(`\nDescrição:\n${hu.description.trim()}`);
  if (hu.acceptance_criteria?.trim()) parts.push(`\nCritérios de Aceite:\n${hu.acceptance_criteria.trim()}`);
  return parts.join("");
}

// ── Componente ───────────────────────────────────────────────────────────────
export function ApfFunctionPointTab() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [sprints, setSprints]                   = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [userStories, setUserStories]           = useState<HuRow[]>([]);
  const [analyses, setAnalyses]                 = useState<Record<string, FpAnalysis>>({});
  const [loadingSprints, setLoadingSprints]     = useState(true);
  const [loadingHUs, setLoadingHUs]             = useState(false);
  const [countingAll, setCountingAll]           = useState(false);
  const [teamContractId, setTeamContractId]     = useState<string | null>(null);
  const [validating, setValidating]             = useState(false);

  const [dialog, setDialog] = useState<ValidationDialog>({
    open: false, hu: null, fpValue: 0,
    correctionReason: "", correctionNotes: "", wasCorrected: false,
  });

  // Learning insights
  const {
    insights,
    loading: insightsLoading,
    lastRefresh: insightsRefresh,
    refresh: insightsRefreshFn,
  } = useLearningInsights(teamId);

  // ── Contrato do time ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) { setTeamContractId(null); return; }
    let cancelled = false;
    (async () => {
      const { data: ct } = await supabase
        .from("contract_teams").select("contract_id")
        .eq("team_id", teamId).limit(1).maybeSingle();
      if (cancelled) return;
      if (ct?.contract_id) { setTeamContractId(ct.contract_id); return; }
      const { data: model } = await supabase
        .from("apf_counting_models" as any).select("contract_id")
        .eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      setTeamContractId((model as any)?.contract_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // ── Sprints ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    setLoadingSprints(true);
    supabase.from("sprints").select("id, name, is_active")
      .eq("team_id", teamId).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => {
        const list = (data ?? []) as SprintOption[];
        setSprints(list);
        const active = list.find((s) => s.is_active);
        if (active) setSelectedSprintId(active.id);
        setLoadingSprints(false);
      });
  }, [teamId]);

  // ── HUs da sprint ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId || !selectedSprintId) { setUserStories([]); return; }
    setLoadingHUs(true);
    supabase.from("user_stories")
      .select("id, code, title, description, acceptance_criteria, story_points, function_points, ai_fp_breakdown, ai_fp_confidence, ai_fp_validated, contract_id")
      .eq("team_id", teamId).eq("sprint_id", selectedSprintId)
      .order("code", { ascending: true }).limit(200)
      .then(({ data, error }) => {
        if (error) {
          supabase.from("user_stories")
            .select("id, code, title, description, acceptance_criteria, story_points, function_points, contract_id")
            .eq("team_id", teamId).eq("sprint_id", selectedSprintId)
            .order("code", { ascending: true }).limit(200)
            .then(({ data: fd }) => {
              setUserStories((fd ?? []).map((h: any) => ({
                ...h,
                acceptance_criteria: h.acceptance_criteria ?? null,
                ai_fp_breakdown: null,
                ai_fp_confidence: null,
                ai_fp_validated: false,
                contract_id: h.contract_id ?? null,
              })));
              setLoadingHUs(false);
            });
          return;
        }
        setUserStories((data ?? []).map((h: any) => ({
          ...h,
          acceptance_criteria: h.acceptance_criteria ?? null,
          ai_fp_breakdown:     h.ai_fp_breakdown ?? null,
          ai_fp_confidence:    h.ai_fp_confidence ?? null,
          ai_fp_validated:     h.ai_fp_validated ?? false,
          contract_id:         h.contract_id ?? null,
        })));
        setLoadingHUs(false);
      });
  }, [teamId, selectedSprintId]);

  // ── Calcular PF via IA ──────────────────────────────────────────────────────
  const countFpForHu = useCallback(async (hu: HuRow) => {
    setAnalyses((prev) => ({
      ...prev,
      [hu.id]: { huId: hu.id, breakdown: prev[hu.id]?.breakdown ?? {} as AiBreakdown, confidence: 0, loading: true, error: null },
    }));
    try {
      const contractId = hu.contract_id ?? teamContractId;
      if (!contractId) throw new Error("Esta HU não está vinculada a um contrato. Edite a HU/time e selecione o contrato APF.");

      const { data: sessionId, error: e1 } = await supabase.rpc("open_counting_session" as any, {
        p_contract_id: contractId, p_project_id: null,
        p_sprint_ref: selectedSprintId, p_release_ref: null,
        p_redmine_ref: hu.code, p_baseline_id: null,
      });
      if (e1 || !sessionId) throw new Error(e1?.message ?? "Falha ao abrir sessão APF");

      const { data: builtPrompt, error: e2 } = await supabase.rpc("build_apf_prompt" as any, { p_session_id: sessionId });
      if (e2 || !builtPrompt) throw new Error(e2?.message ?? "Falha ao montar prompt APF");

      const { data: aiResult, error: e3 } = await supabase.functions.invoke("apf-generate", {
        body: {
          prompt: `${builtPrompt}\n\n=== HISTÓRIA DE USUÁRIO ===\n${buildStoryText(hu)}\n=== FIM ===`,
          skipDocx: true,
        },
      });
      if (e3) throw new Error(e3.message);
      if (!aiResult?.success) throw new Error(aiResult?.userMessage ?? "Erro na IA");

      let items: any[];
      let breakdown: AiBreakdown;
      let totalPf: number;
      let confidence: number;

      try {
        const raw = String(aiResult.markdown ?? "").trim()
          .replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(raw);
        const list: any[] = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.efs ?? parsed.functions ?? []);
        breakdown = { EI: 0, EO: 0, EQ: 0, ILF: 0, EIF: 0, total: 0 };
        for (const item of list) {
          const type       = String(item.type ?? item.tipo ?? "").toUpperCase();
          const complexity = String(item.complexity ?? item.complexidade ?? "MEDIUM").toUpperCase();
          const weight     = complexity === "SIMPLE" ? 3 : complexity === "COMPLEX" ? 6 : 4;
          if (type in breakdown) (breakdown as any)[type] += 1;
          breakdown.total += weight;
        }
        items      = list;
        totalPf    = breakdown.total;
        confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.8;
      } catch {
        throw new Error("A IA não retornou JSON válido. Tente novamente.");
      }
      if (!items.length) throw new Error("A IA não retornou nenhum item de contagem.");

      const { error: e4 } = await supabase.rpc("save_counting_items" as any, {
        p_session_id: sessionId, p_items: items, p_ai_model: aiResult.providerUsed ?? null,
      });
      if (e4) throw new Error(e4.message);

      setAnalyses((prev) => ({
        ...prev,
        [hu.id]: { huId: hu.id, breakdown, confidence, loading: false, error: null },
      }));

      // Persiste metadados RAG no estado local para usar na validação
      setUserStories((prev) => prev.map((h) =>
        h.id !== hu.id ? h : {
          ...h,
          function_points:    totalPf,
          ai_fp_breakdown:    breakdown,
          ai_fp_confidence:   confidence,
          _sessionId:         sessionId,
          _providerUsed:      aiResult.providerUsed ?? undefined,
          _ragWasUsed:        aiResult.ragWasUsed ?? false,
          _ragCaseCount:      aiResult.ragCaseCount ?? 0,
          _promptVersionHash: aiResult.promptVersionHash ?? undefined,
          _rawItems:          items,
        }
      ));

      toast.success(`PF calculado para ${hu.code}: ${totalPf} PF`);
    } catch (err: any) {
      setAnalyses((prev) => ({
        ...prev,
        [hu.id]: { ...prev[hu.id], loading: false, error: err?.message ?? "Erro ao calcular PF" },
      }));
      toast.error(`Erro ao calcular ${hu.code}: ${err?.message ?? "tente novamente"}`);
    }
  }, [teamId, selectedSprintId, teamContractId]);

  // ── Abre diálogo de validação ───────────────────────────────────────────────
  const openValidationDialog = useCallback((hu: HuRow, fpValue: number) => {
    const aiTotalPf    = hu.ai_fp_breakdown?.total ?? analyses[hu.id]?.breakdown?.total ?? fpValue;
    const wasCorrected = fpValue !== aiTotalPf;
    setDialog({
      open: true, hu, fpValue,
      correctionReason: "", correctionNotes: "", wasCorrected,
    });
  }, [analyses]);

  // ── Confirma validação — fecha o loop de aprendizado ───────────────────────
  const confirmValidation = useCallback(async () => {
    const { hu, fpValue, correctionReason, correctionNotes, wasCorrected } = dialog;
    if (!hu) return;

    if (wasCorrected && !correctionReason) {
      toast.warning("Selecione o motivo da correção antes de validar.");
      return;
    }

    setValidating(true);
    try {
      // 1. Atualiza user_stories
      const { error: dbErr } = await supabase
        .from("user_stories")
        .update({ function_points: fpValue, ai_fp_validated: true } as any)
        .eq("id", hu.id);
      if (dbErr) throw new Error(dbErr.message);

      // 2. Persiste evento de validação (fecha o loop de aprendizado)
      const aiBreakdown = hu.ai_fp_breakdown ?? analyses[hu.id]?.breakdown;
      const { error: fnErr } = await supabase.functions.invoke("apf-validate", {
        body: {
          session_id:                hu._sessionId ?? hu.id,
          project_id:                teamId,
          team_id:                   teamId,
          hu_text:                   buildStoryText(hu),
          hu_title:                  hu.title,

          ai_functional_type:        "mixed",
          ai_complexity:             "mixed",
          ai_pf_bruto:               aiBreakdown?.total ?? null,
          ai_confidence_score:       hu.ai_fp_confidence ?? null,
          ai_reasoning:              aiBreakdown?.reasoning ?? null,
          provider_id:               hu._providerUsed ?? null,
          prompt_version_hash:       hu._promptVersionHash ?? null,
          rag_was_used:              hu._ragWasUsed ?? false,
          rag_case_count:            hu._ragCaseCount ?? 0,

          validated_functional_type: "mixed",
          validated_complexity:      "mixed",
          validated_pf_bruto:        fpValue,

          correction_reason_code:    wasCorrected ? correctionReason : undefined,
          correction_notes:          correctionNotes || undefined,
        },
      });
      // Não bloqueia o fluxo se apf-validate falhar — só loga
      if (fnErr) console.warn("apf-validate não persistido:", fnErr.message);

      setUserStories((prev) => prev.map((h) =>
        h.id === hu.id ? { ...h, function_points: fpValue, ai_fp_validated: true } : h
      ));

      setDialog((d) => ({ ...d, open: false }));
      toast.success(`${hu.code} — ${fpValue} PF validado!`);

      // Atualiza painel de learning insights
      insightsRefreshFn();
    } catch (err: any) {
      toast.error("Erro ao validar", { description: err?.message });
    } finally {
      setValidating(false);
    }
  }, [dialog, analyses, teamId, insightsRefreshFn]);

  // ── Contar todos pendentes ──────────────────────────────────────────────────
  const countAllPending = useCallback(async () => {
    const pending = userStories.filter((h) => !h.function_points && !h.ai_fp_validated);
    if (!pending.length) { toast.info("Todas as HUs já possuem PF calculado."); return; }
    setCountingAll(true);
    for (const hu of pending) await countFpForHu(hu);
    setCountingAll(false);
    toast.success(`Contagem concluída para ${pending.length} HU(s)!`);
  }, [userStories, countFpForHu]);

  // ── Totais ──────────────────────────────────────────────────────────────────
  const totalFp        = userStories.reduce((acc, h) => acc + (h.function_points ?? 0), 0);
  const validatedCount = userStories.filter((h) => h.ai_fp_validated).length;
  const pendingCount   = userStories.filter((h) => !h.function_points).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadingSprints) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* 🧠 Learning Insights — painel de aprendizado bidirecional */}
      <LearningInsightsPanel
        insights={insights}
        loading={insightsLoading}
        lastRefresh={insightsRefresh}
        onRefresh={insightsRefreshFn}
      />

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
            <Button size="sm" variant="outline" onClick={() => {
              setSelectedSprintId("");
              setTimeout(() => setSelectedSprintId(selectedSprintId), 50);
            }}>
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

      {/* KPIs da sprint */}
      {userStories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total HUs", value: userStories.length,  color: "text-foreground" },
            { label: "Total PF",  value: totalFp.toFixed(1),   color: "text-primary" },
            { label: "Validados", value: validatedCount,        color: "text-emerald-600" },
            { label: "Pendentes", value: pendingCount,          color: "text-amber-600" },
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

      {/* Tabela de HUs */}
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
                  const analysis   = analyses[hu.id];
                  const fpValue    = hu.function_points ?? analysis?.breakdown?.total;
                  const confidence = hu.ai_fp_confidence ?? analysis?.confidence;
                  const breakdown  = hu.ai_fp_breakdown ?? analysis?.breakdown;
                  const isLoading  = analysis?.loading ?? false;
                  const hasError   = !!analysis?.error;

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
                          : fpValue ? fpValue : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {breakdown ? (
                          <Badge variant="outline" className="text-xs">
                            {Object.entries(breakdown)
                              .filter(([k, v]) => k !== "total" && k !== "reasoning" && (v as number) > 0)
                              .map(([k, v]) => `${k}:${v}`).join(" ")}
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
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Erro
                          </Badge>
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
                            onClick={() => fpValue ? openValidationDialog(hu, fpValue) : countFpForHu(hu)}
                            disabled={isLoading}
                          >
                            {fpValue
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

      {/* Diálogo de validação com motivo de correção */}
      <Dialog
        open={dialog.open}
        onOpenChange={(open) => !validating && setDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Validar contagem — {dialog.hu?.code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Resumo IA vs. especialista */}
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

            {/* Motivo — só aparece quando houve correção */}
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
                    onValueChange={(v) =>
                      setDialog((d) => ({ ...d, correctionReason: v as CorrectionReason }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CORRECTION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
                    onChange={(e) =>
                      setDialog((d) => ({ ...d, correctionNotes: e.target.value }))
                    }
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialog((d) => ({ ...d, open: false }))}
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
