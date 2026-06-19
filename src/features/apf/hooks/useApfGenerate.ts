/**
 * useApfGenerate (v2)
 * -------------------
 * Integrado ao AiPipelineContext:
 *  - Lê provedor ativo do contexto compartilhado (Fase 1)
 *  - Após geração bem-sucedida, salva lastHuGenerationId no contexto (Fase 2)
 *  - Sprint selecionada sincroniza com activePipelineSprintId do contexto
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import {
  fetchTemplates,
  fetchGenerations,
  enqueueApfJob,
  triggerApfWorker,
  type ApfTemplate,
  type ApfGeneration
} from "../services/apf.service";
import { useApfJob } from "./useApfJob";
import { useAiPipeline } from "../contexts/AiPipelineContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProgressStep =
  | "idle"
  | "collecting"
  | "queued"
  | "calling_ai"
  | "trying_fallback"
  | "saving"
  | "done"
  | "failed"
  | "timeout";
export type OutputFormat = "docx" | "md";

export type Question = {
  id: string;
  text: string;
  kind: "yesno" | "text";
  followUp?: string;
};

export type AnswerEntry = {
  value: string;
  detail?: string;
};

export function useApfGenerate(moduleId?: string) {
  const { currentTeamId, user } = useAuth();
  const { sprints } = useSprint();

  // ── Lê provedor do contexto compartilhado (Fase 1) ────────────────────────
  const pipeline = useAiPipeline();
  const {
    selectedProviderId,
    setSelectedProviderId,
    selectedProvider,
    needsApiKey,
    apiKey,
    setApiKey,
    aiProviders,
    activePipelineSprintId,
    setActivePipelineSprintId,
    setLastHuGenerationId,
    getAiPayload,
  } = pipeline;

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [allTemplates, setAllTemplates]             = useState<ApfTemplate[]>([]);
  const [generating, setGenerating]                 = useState(false);
  const [progressStep, setProgressStep]             = useState<ProgressStep>("idle");
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [lastError, setLastError]                   = useState<{ message: string; reason?: string } | null>(null);
  const [generations, setGenerations]               = useState<(ApfGeneration & { template_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory]         = useState(false);
  const [outputFormat, setOutputFormat]             = useState<OutputFormat>("docx");
  const [questions, setQuestions]                   = useState<Question[]>([]);
  const [answers, setAnswers]                       = useState<Record<string, AnswerEntry>>({});
  const [showQuestions, setShowQuestions]           = useState(false);
  const [sqlFiles, setSqlFiles]                     = useState<File[]>([]);
  const [currentJobId, setCurrentJobId]             = useState<string | null>(null);

  const [lastResult, setLastResult] = useState<{
    markdown: string;
    baseFilename: string;
    pfBreakdown: Record<string, number>;
    pfTotal: number | null;
    generationId?: string; // novo: rastreabilidade
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Sprint sincronizada com o contexto do pipeline
  const selectedSprintId = activePipelineSprintId;
  const setSelectedSprintId = setActivePipelineSprintId;

  // ── Realtime do job ────────────────────────────────────────────────────────
  const { job: currentJob, isDone: jobDone, isFailed: jobFailed } = useApfJob(currentJobId);

  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.status === "processing") setProgressStep("calling_ai");

    if (jobDone && currentJob.result) {
      const result = currentJob.result as any;
      const generationId = currentJob.id;

      setLastResult({
        markdown:     result.markdown ?? "",
        baseFilename: result.outputFilename ?? "APF",
        pfBreakdown:  result.pfBreakdown ?? {},
        pfTotal:      result.pfTotal ?? null,
        generationId,
      });

      // ── Fase 2: salva ID no contexto para a aba PF usar automaticamente ──
      if (generationId) setLastHuGenerationId(generationId);

      setShowPreview(true);
      setProgressStep("done");
      setGenerating(false);
      setCurrentJobId(null);
      toast.success("Documento APF gerado com sucesso!");
      setTimeout(() => setProgressStep((s) => (s === "done" ? "idle" : s)), 3000);
    }

    if (jobFailed) {
      const msg = currentJob.error_message ?? "Falha após 3 tentativas";
      setLastError({ message: msg });
      setProgressStep("failed");
      setGenerating(false);
      setCurrentJobId(null);
      toast.error(msg);
    }
  }, [currentJob, jobDone, jobFailed, setLastHuGenerationId]);

  useEffect(() => {
    if (!currentTeamId) return;
    fetchTemplates(currentTeamId).then(setAllTemplates).catch(() => {});
  }, [currentTeamId]);

  const templates = useMemo(() => {
    return allTemplates.filter((t) => {
      if (!t.is_active) return false;
      if (!moduleId) return true;
      if (!t.module_id) return true;
      return t.module_id === moduleId;
    });
  }, [allTemplates, moduleId]);

  useEffect(() => {
    if (!currentTeamId || !selectedSprintId) { setGenerations([]); return; }
    setLoadingHistory(true);
    fetchGenerations(currentTeamId, selectedSprintId)
      .then(setGenerations).catch(() => {}).finally(() => setLoadingHistory(false));
  }, [currentTeamId, selectedSprintId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // Compat: providerCfg mantido para não quebrar componentes existentes
  const providerCfg = useMemo(() => ({
    needsKey: needsApiKey,
    placeholder: {
      openai: "sk-...", gemini: "AIza...", anthropic: "sk-ant-...", lovable: "", manus: "api-...",
    }[selectedProvider?.provider_type ?? ""] ?? "Cole sua API key",
  }), [needsApiKey, selectedProvider]);

  const canGenerate = useMemo(() => {
    if (!selectedSprintId || !selectedTemplateId) return false;
    if (!selectedProviderId) return false;
    if (needsApiKey && !apiKey.trim()) return false;
    return true;
  }, [selectedSprintId, selectedTemplateId, selectedProviderId, needsApiKey, apiKey]);

  const allQuestionsAnswered = useMemo(() => {
    if (questions.length === 0) return true;
    return questions.every((q) => {
      const a = answers[q.id];
      if (!a?.value) return false;
      if (q.kind === "yesno" && a.value === "sim" && !a.detail?.trim()) return false;
      return true;
    });
  }, [questions, answers]);

  // ── generateGeneric: usa getAiPayload() do contexto ───────────────────────
  const generateGeneric = useCallback(async (prompt: string, baseFilename: string) => {
    if (!currentTeamId || !user) throw new Error("Sessão inválida");
    setGenerating(true);
    setLastError(null);
    setElapsedSeconds(0);
    setProgressStep("collecting");

    const startTs = Date.now();
    const tick = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTs) / 1000));
    }, 500);

    try {
      const aiPayload = getAiPayload();
      setProgressStep("queued");

      const { jobId } = await enqueueApfJob(currentTeamId, {
        prompt,
        providerId: aiPayload.providerId,
        provider:   aiPayload.provider,
        apiKey:     aiPayload.apiKey,
        files:      [],
        skipDocx:   true,
      });

      setCurrentJobId(jobId);
      triggerApfWorker();
      return { jobId };
    } catch (err: any) {
      const msg = err?.message ?? "Falha desconhecida";
      setLastError({ message: msg });
      setProgressStep("failed");
      setGenerating(false);
      clearInterval(tick);
      throw err;
    } finally {
      clearInterval(tick);
    }
  }, [currentTeamId, user, getAiPayload]);

  const handleGenerateClick = useCallback(() => {
    if (!selectedTemplate) return;
    const tplQuestions: Question[] = (selectedTemplate as any).questions ?? [];
    if (tplQuestions.length > 0) {
      setQuestions(tplQuestions);
      setAnswers({});
      setShowQuestions(true);
    } else {
      setQuestions([]);
      setAnswers({});
      runGeneration();
    }
  }, [selectedTemplate, selectedSprintId]);

  const runGeneration = useCallback(async () => {
    if (!selectedTemplate || !selectedSprintId) return;
    setShowQuestions(false);
    const sprintObj = (sprints ?? []).find((s: any) => s.id === selectedSprintId);
    const sprintName = sprintObj?.name ?? selectedSprintId;
    const baseFilename = `APF_${sprintName}_${selectedTemplate.name}`.replace(/\s+/g, "_");
    let prompt =
      (selectedTemplate as any).prompt_template ??
      (selectedTemplate as any).prompt_content ??
      "";
    if (!prompt.trim()) {
      toast.error("Template sem prompt configurado. Edite-o em Gerenciar Templates.");
      return;
    }
    if (Object.keys(answers).length > 0) {
      prompt += "\n\n--- Contexto adicional ---\n";
      questions.forEach((q) => {
        const a = answers[q.id];
        if (a?.value) {
          prompt += `\n${q.text}\nResposta: ${a.value}`;
          if (a.detail) prompt += ` — ${a.detail}`;
        }
      });
    }
    try {
      await generateGeneric(prompt, baseFilename);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enfileirar geração APF");
    }
  }, [selectedTemplate, selectedSprintId, sprints, answers, questions, generateGeneric]);

  return {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates, selectedTemplate,
    aiProviders,
    selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    outputFormat, setOutputFormat,
    generating,
    canGenerate,
    progressStep,
    elapsedSeconds,
    lastError,
    generations, loadingHistory,
    lastResult, setLastResult,
    showPreview, setShowPreview,
    questions, answers, setAnswers,
    sqlFiles, setSqlFiles,
    showQuestions, setShowQuestions,
    allQuestionsAnswered,
    handleGenerateClick,
    runGeneration,
    generateGeneric,
    providerCfg,
    currentJobId,
  };
}
