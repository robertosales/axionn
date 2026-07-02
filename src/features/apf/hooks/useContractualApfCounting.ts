import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContractualItem, HuRow } from "../types/apfItem.types";
import type {
  AnalysisReviewDecision,
  ApfProcessAnalysis,
  FactorReviewInput,
  GenerateResponse,
  LogicalFileCandidate,
  PersistSummary,
  ProjectBaselineProcessCandidate,
  ValidationDialogState,
  ValidationItemState,
  ValidationPrecedentCandidate,
} from "../types/apfRuntime.types";
import {
  buildStoryText,
  effectiveFactor,
  effectiveFunction,
  effectivePfBruto,
  effectivePfFs,
} from "../utils/contractualApf.helpers";
import {
  buildFallbackStructuredAnalysis,
  buildStructuredProcessAnalysisPrompt,
  computeProcessAnalysisHash,
  inferImpactFactor,
  normalizeStructuredProcessAnalysis,
  parseStructuredProcessAnalysis,
  PROCESS_ANALYSIS_PROMPT_VERSION,
  PROCESS_ANALYSIS_SCHEMA_VERSION,
} from "../services/projectBaselineCounting.service";
import { validateContractualItems } from "../services/contractualValidation.service";
import { useApfCatalog } from "./useApfCatalog";

interface AnalysisReviewDialogState {
  open: boolean;
  hu: HuRow | null;
  analysis: ApfProcessAnalysis | null;
  decisions: AnalysisReviewDecision[];
}

async function resolveActiveProviderId(): Promise<string> {
  const { data, error } = await supabase
    .from("ai_providers" as any)
    .select("id")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !(data as any)?.id) {
    throw new Error("Nenhum provedor de IA ativo foi encontrado.");
  }
  return (data as any).id;
}

async function edgeError(error: any, data?: GenerateResponse | null) {
  if ((data as any)?.error) return (data as any).error;
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      return payload?.error
        ?? payload?.rawError
        ?? payload?.userMessage
        ?? payload?.message
        ?? error.message;
    } catch {
      // Usa a mensagem padrão abaixo.
    }
  }
  return error?.message ?? "Falha ao executar a análise APF.";
}

function normalizeCountingItems(summary: PersistSummary) {
  return (summary.items ?? []).map((item) => ({
    ...item,
    match_confidence: item.match_confidence ?? item.confidence ?? null,
  }));
}

export function useContractualApfCounting() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const catalog = useApfCatalog(teamId);
  const [countingAll, setCountingAll] = useState(false);
  const [validating, setValidating] = useState(false);
  const [resolvingAnalysis, setResolvingAnalysis] = useState(false);
  const [dialog, setDialog] = useState<ValidationDialogState>({
    open: false,
    hu: null,
    items: [],
    correctionReason: "",
    correctionNotes: "",
  });
  const [analysisDialog, setAnalysisDialog] = useState<AnalysisReviewDialogState>({
    open: false,
    hu: null,
    analysis: null,
    decisions: [],
  });

  const applyCountingResult = useCallback((args: {
    hu: HuRow;
    summary: PersistSummary;
    analysis: ApfProcessAnalysis | null;
    providerUsed?: string | null;
    sessionId: string;
  }) => {
    const items = normalizeCountingItems(args.summary);
    const confidence = items.length
      ? items.reduce((sum, item) => sum + Number(item.match_confidence ?? 0.5), 0) / items.length
      : null;
    catalog.setStories((rows) => rows.map((row) => row.id === args.hu.id ? {
      ...row,
      function_points: Number(args.summary.story_pf_fs),
      apf_pf_bruto: Number(args.summary.story_pf_bruto),
      apf_pf_fs: Number(args.summary.story_pf_fs),
      ai_fp_confidence: confidence,
      ai_fp_validated: false,
      _items: items,
      _analysis: args.analysis,
      _loading: false,
      _error: null,
      _providerUsed: args.providerUsed ?? args.analysis?.provider_name ?? null,
      _sessionId: String(args.summary.session_id ?? args.sessionId),
    } : row));
  }, [catalog.setStories]);

  const getAnalysis = useCallback(async (analysisId: string) => {
    const { data, error } = await supabase.rpc(
      "get_apf_process_analysis" as any,
      { p_analysis_id: analysisId } as any,
    );
    if (error || !data) throw new Error(error?.message ?? "Análise não encontrada.");
    return data as unknown as ApfProcessAnalysis;
  }, []);

  const materializeAnalysis = useCallback(async (
    analysisId: string,
    sessionId: string,
  ) => {
    const { data, error } = await supabase.rpc(
      "materialize_apf_process_analysis" as any,
      { p_analysis_id: analysisId, p_session_id: sessionId } as any,
    );
    if (error) throw new Error(error.message);
    return (data as any)?.counting as PersistSummary;
  }, []);

  const countForHu = useCallback(async (
    hu: HuRow,
    options: { forceReanalysis?: boolean } = {},
  ): Promise<boolean> => {
    if (!catalog.projectId || !catalog.selectedSprint || !catalog.context) {
      toast.error("Selecione um projeto com baseline ativa antes de calcular.");
      return false;
    }

    catalog.setStories((rows) => rows.map((row) =>
      row.id === hu.id ? { ...row, _loading: true, _error: null } : row,
    ));

    try {
      const storyText = buildStoryText(hu);
      const { data: sessionId, error: sessionError } = await supabase.rpc(
        "open_counting_session" as any,
        {
          p_project_id: catalog.projectId,
          p_sprint_ref: catalog.selectedSprint.name,
          p_release_ref: null,
          p_redmine_ref: null,
          p_baseline_id: catalog.context.baseline.id,
        } as any,
      );
      if (sessionError || !sessionId) {
        throw new Error(sessionError?.message ?? "Não foi possível abrir a sessão APF.");
      }

      const inputHash = await computeProcessAnalysisHash({
        storyId: hu.id,
        storyText,
        baselineId: catalog.context.baseline.id,
        baselineVersion: catalog.context.baseline.version,
        forceNonce: options.forceReanalysis ? new Date().toISOString() : undefined,
      });

      if (!options.forceReanalysis) {
        const { data: cached } = await supabase
          .from("apf_process_analysis_runs" as any)
          .select("id,status")
          .eq("story_id", hu.id)
          .eq("baseline_id", catalog.context.baseline.id)
          .eq("input_hash", inputHash)
          .eq("prompt_version", PROCESS_ANALYSIS_PROMPT_VERSION)
          .eq("schema_version", PROCESS_ANALYSIS_SCHEMA_VERSION)
          .in("status", ["ok", "review_required", "counted"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if ((cached as any)?.id) {
          const analysis = await getAnalysis((cached as any).id);
          if (analysis.status === "review_required") {
            catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
              ...row,
              _analysis: analysis,
              _loading: false,
              _error: null,
              _sessionId: String(sessionId),
            } : row));
            toast.warning(`${hu.code}: análise requer validação humana.`);
            return true;
          }
          const summary = await materializeAnalysis(analysis.id, String(sessionId));
          const refreshed = await getAnalysis(analysis.id);
          applyCountingResult({ hu, summary, analysis: refreshed, sessionId: String(sessionId) });
          return true;
        }
      }

      const { data: candidateRows, error: candidateError } = await supabase.rpc(
        "get_apf_project_process_candidates" as any,
        { p_project_id: catalog.projectId, p_story_text: storyText, p_limit: 8 } as any,
      );
      if (candidateError) throw new Error(candidateError.message);
      const candidates = (candidateRows ?? []) as ProjectBaselineProcessCandidate[];

      const { data: logicalRows } = await supabase
        .from("apf_baseline_items" as any)
        .select("id,item_ref,description,function_sigla")
        .eq("baseline_id", catalog.context.baseline.id)
        .in("function_sigla", ["ALI", "AIE"])
        .limit(600);
      const logicalFiles = ((logicalRows ?? []) as any[]).map((row) => ({
        ...row,
        function_sigla: row.function_sigla as "ALI" | "AIE",
      })) as LogicalFileCandidate[];

      const { data: precedentRows } = await supabase
        .from("apf_validation_events" as any)
        .select("hu_title,validated_functional_type,validated_factor_sigla,correction_notes,ai_reasoning,baseline_item_id")
        .eq("project_id", catalog.projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      const precedents = (precedentRows ?? []) as ValidationPrecedentCandidate[];

      const providerId = await resolveActiveProviderId();
      const allowedFactors = catalog.context.impact_factors.map((factor) => factor.sigla);
      const inferredFactor = inferImpactFactor(storyText, allowedFactors);
      let providerUsed = "Baseline do projeto — revisão";
      let rawResponse = "";
      let normalized: any;

      try {
        const prompt = buildStructuredProcessAnalysisPrompt({
          storyId: hu.id,
          storyText,
          candidates,
          logicalFiles,
          precedents,
        });
        const { data: generated, error: generationError } = await supabase.functions.invoke<GenerateResponse>(
          "apf-generate",
          { body: { prompt, providerId, skipDocx: true } },
        );
        if (generationError) throw new Error(await edgeError(generationError, generated));
        if (!generated?.success || !generated.markdown) {
          throw new Error(generated?.userMessage ?? generated?.rawError ?? "Resposta vazia da IA.");
        }
        rawResponse = generated.markdown;
        providerUsed = generated.providerUsed ?? "IA";
        normalized = normalizeStructuredProcessAnalysis(
          parseStructuredProcessAnalysis(rawResponse),
          {
            storyId: hu.id,
            storyCode: hu.code,
            storyTitle: hu.title,
            candidates,
            logicalFiles,
          },
        );
      } catch (analysisError: any) {
        const reason = analysisError?.message ?? "A resposta da IA não pôde ser validada.";
        rawResponse ||= reason;
        normalized = buildFallbackStructuredAnalysis({
          storyId: hu.id,
          storyCode: hu.code,
          storyTitle: hu.title,
          storyText,
          candidates,
          reason,
        });
      }

      const { data: analysisId, error: persistError } = await supabase.rpc(
        "persist_apf_process_analysis" as any,
        {
          p_project_id: catalog.projectId,
          p_story_id: hu.id,
          p_baseline_id: catalog.context.baseline.id,
          p_provider_id: providerId,
          p_provider_name: providerUsed,
          p_model_name: null,
          p_validation_mode: "assisted",
          p_input_hash: inputHash,
          p_prompt_version: PROCESS_ANALYSIS_PROMPT_VERSION,
          p_schema_version: PROCESS_ANALYSIS_SCHEMA_VERSION,
          p_factor_sigla: inferredFactor,
          p_raw_response: rawResponse,
          p_analysis: normalized,
        } as any,
      );
      if (persistError || !analysisId) {
        throw new Error(persistError?.message ?? "Não foi possível persistir a análise.");
      }

      const analysis = await getAnalysis(String(analysisId));
      if (analysis.status === "review_required") {
        catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
          ...row,
          function_points: null,
          apf_pf_bruto: null,
          apf_pf_fs: null,
          ai_fp_validated: false,
          _items: [],
          _analysis: analysis,
          _loading: false,
          _error: null,
          _providerUsed: providerUsed,
          _sessionId: String(sessionId),
        } : row));
        toast.warning(`${hu.code}: análise salva para revisão`, {
          description: `${analysis.processos.length} processo(s) identificado(s); nenhum PF foi gerado antes da decisão humana.`,
        });
        return true;
      }

      const summary = await materializeAnalysis(analysis.id, String(sessionId));
      const refreshed = await getAnalysis(analysis.id);
      applyCountingResult({
        hu,
        summary,
        analysis: refreshed,
        providerUsed,
        sessionId: String(sessionId),
      });
      toast.success(`${hu.code}: ${Number(summary.story_pf_fs).toFixed(2)} PF Simples`, {
        description: `${analysis.processos.length} processo(s) analisado(s) · fator ${inferredFactor}`,
      });
      return true;
    } catch (error: any) {
      catalog.setStories((rows) => rows.map((row) => row.id === hu.id
        ? { ...row, _loading: false, _error: error?.message ?? "Erro ao calcular" }
        : row));
      toast.error(`Erro ao calcular ${hu.code}`, { description: error?.message });
      return false;
    }
  }, [
    applyCountingResult,
    catalog.context,
    catalog.projectId,
    catalog.selectedSprint,
    catalog.setStories,
    getAnalysis,
    materializeAnalysis,
  ]);

  const recalculateHu = useCallback(async (hu: HuRow) => {
    try {
      if (hu._sessionId && hu._items.length) {
        const { error } = await supabase.rpc("reset_apf_story_counting" as any, {
          p_session_id: hu._sessionId,
          p_story_id: hu.id,
          p_reason: "Recálculo solicitado após nova análise de processos.",
        } as any);
        if (error) throw error;
      }
      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: null,
        apf_pf_bruto: null,
        apf_pf_fs: null,
        ai_fp_confidence: null,
        ai_fp_validated: false,
        _items: [],
        _analysis: null,
        _sessionId: null,
        _error: null,
      } : row));
      await countForHu({ ...hu, _items: [], _analysis: null, _sessionId: null }, {
        forceReanalysis: true,
      });
    } catch (error: any) {
      toast.error(`Falha ao recalcular ${hu.code}`, { description: error?.message });
    }
  }, [catalog.setStories, countForHu]);

  const countAll = useCallback(async () => {
    const pending = catalog.stories.filter(
      (story) => story._items.length === 0 && !story._analysis,
    );
    if (!pending.length) return;
    setCountingAll(true);
    let successes = 0;
    const failures: string[] = [];
    for (const story of pending) {
      if (await countForHu(story)) successes += 1;
      else failures.push(story.code);
    }
    setCountingAll(false);
    if (failures.length) {
      toast.warning(`${successes} sucesso(s) e ${failures.length} falha(s)`, {
        description: failures.join(", "),
      });
    } else toast.success(`${successes} HU(s) analisadas.`);
  }, [catalog.stories, countForHu]);

  function openAnalysisReview(hu: HuRow) {
    if (!hu._analysis) return;
    setAnalysisDialog({
      open: true,
      hu,
      analysis: hu._analysis,
      decisions: hu._analysis.processos.map((process) => ({
        process_id: process.id,
        send: process.deve_contar_como_processo_elementar
          && process.recomendacao_para_contador_existente !== "nao_enviar",
        baseline_item_id: process.selected_baseline_item_id
          ?? process.baseline_analogas.find((analog) => ["EE", "CE", "SE", "TRN"].includes(analog.tipo))?.baseline_item_id
          ?? null,
      })),
    });
  }

  function updateAnalysisDecision(index: number, changes: Partial<AnalysisReviewDecision>) {
    setAnalysisDialog((current) => ({
      ...current,
      decisions: current.decisions.map((decision, decisionIndex) =>
        decisionIndex === index ? { ...decision, ...changes } : decision,
      ),
    }));
  }

  async function confirmAnalysisReview(factorReview: FactorReviewInput) {
    if (!analysisDialog.analysis || !analysisDialog.hu?._sessionId) return;
    setResolvingAnalysis(true);
    try {
      const { data, error } = await supabase.rpc(
        "resolve_apf_process_analysis_v2" as any,
        {
          p_analysis_id: analysisDialog.analysis.id,
          p_session_id: analysisDialog.hu._sessionId,
          p_decisions: analysisDialog.decisions,
          p_factor_sigla: factorReview.factor_sigla,
          p_factor_override_reason: factorReview.factor_override_reason || null,
          p_factor_override_notes: factorReview.factor_override_notes || null,
        } as any,
      );
      if (error) throw error;
      const summary = (data as any)?.counting as PersistSummary;
      if (!summary) throw new Error("A análise ainda possui decisões pendentes.");
      const analysis = await getAnalysis(analysisDialog.analysis.id);
      applyCountingResult({
        hu: analysisDialog.hu,
        summary,
        analysis,
        sessionId: analysisDialog.hu._sessionId,
      });
      setAnalysisDialog((current) => ({ ...current, open: false }));
      toast.success(`${analysisDialog.hu.code}: processos e fator enviados ao contador.`);
    } catch (error: any) {
      toast.error("Falha ao confirmar a análise", { description: error?.message });
    } finally {
      setResolvingAnalysis(false);
    }
  }

  function openValidation(hu: HuRow) {
    if (!hu._items.length) {
      toast.warning("A análise precisa ser enviada ao contador antes da validação métrica.");
      return;
    }
    setDialog({
      open: true,
      hu,
      items: hu._items.map((item) => ({
        ...item,
        selectedFunction: effectiveFunction(item),
        selectedFactor: effectiveFactor(item),
        selectedProcessRole: item.process_role ?? "central",
        selectedProcessComplete: item.process_is_complete ?? true,
        selectedProcessIndependent: item.process_is_independent ?? true,
        selectedProcessPrecedent: item.separation_precedent_ref ?? "",
      })),
      correctionReason: "",
      correctionNotes: "",
    });
  }

  const dialogWasCorrected = dialog.items.some((item) =>
    item.selectedFunction !== effectiveFunction(item)
    || item.selectedFactor !== effectiveFactor(item)
    || item.selectedProcessRole !== (item.process_role ?? "central")
    || item.selectedProcessComplete !== (item.process_is_complete ?? true)
    || item.selectedProcessIndependent !== (item.process_is_independent ?? true)
    || item.selectedProcessPrecedent !== (item.separation_precedent_ref ?? "")
    || item.counting_decision === "review_required",
  );

  function updateValidationItem(index: number, changes: Partial<ValidationItemState>) {
    setDialog((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  }

  const getFunctionWeight = (sigla: string) => sigla === "N/A"
    ? 0
    : Number(catalog.context?.function_types.find((item) => item.sigla === sigla)?.weight ?? 0);
  const getFactorPct = (sigla: string) => sigla === "N/A"
    ? 0
    : Number(catalog.context?.impact_factors.find((item) => item.sigla === sigla)?.contribution_pct ?? 0);

  async function confirmValidation() {
    if (!dialog.hu || !catalog.context) return;
    setValidating(true);
    try {
      const validated = await validateContractualItems({
        projectId: catalog.projectId,
        teamId,
        context: catalog.context,
        hu: dialog.hu,
        items: dialog.items,
        reason: dialog.correctionReason,
        notes: dialog.correctionNotes,
      });
      const pfBruto = validated.reduce((sum, item) => sum + effectivePfBruto(item), 0);
      const pfFs = validated.reduce((sum, item) => sum + effectivePfFs(item), 0);
      catalog.setStories((rows) => rows.map((row) => row.id === dialog.hu?.id ? {
        ...row,
        _items: validated,
        function_points: pfFs,
        apf_pf_bruto: pfBruto,
        apf_pf_fs: pfFs,
        ai_fp_validated: true,
      } : row));
      setDialog((current) => ({ ...current, open: false }));
      toast.success(`${dialog.hu.code} validada em ${pfFs.toFixed(2)} PF Simples.`);
    } catch (error: any) {
      toast.error("Falha ao validar", { description: error?.message });
    } finally {
      setValidating(false);
    }
  }

  const totals = useMemo(() => ({
    pfBruto: catalog.stories.reduce((sum, story) => sum + Number(story.apf_pf_bruto ?? 0), 0),
    pfFs: catalog.stories.reduce(
      (sum, story) => sum + Number(story.apf_pf_fs ?? story.function_points ?? 0), 0,
    ),
    validated: catalog.stories.filter((story) => story.ai_fp_validated).length,
  }), [catalog.stories]);

  return {
    teamId,
    ...catalog,
    countingAll,
    validating,
    resolvingAnalysis,
    dialog,
    setDialog,
    analysisDialog,
    setAnalysisDialog,
    dialogWasCorrected,
    updateValidationItem,
    updateAnalysisDecision,
    countForHu,
    recalculateHu,
    countAll,
    openAnalysisReview,
    confirmAnalysisReview,
    openValidation,
    confirmValidation,
    totals,
    getFunctionWeight,
    getFactorPct,
  };
}
