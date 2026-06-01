import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import {
  fetchTemplates,
  fetchGenerations,
  createGeneration,
  enqueueApfJob,
  triggerApfWorker,
  type ApfTemplate,
  type ApfGeneration
} from "../services/apf.service";
import { useApfJob } from "./useApfJob";
import { listAIProviders, type AIProvider } from "@/features/admin/services/aiProviders.service";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProgressStep =
  | "idle"
  | "collecting"
  | "queued"      // novo: job enfileirado, aguardando worker
  | "calling_ai"  // worker está processando
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

const INLINE_AI_PROVIDERS: AIProvider[] = [
  {
    id: "inline:lovable",
    name: "Lovable AI (Gratuita) — recomendada",
    provider_type: "lovable",
    model: "google/gemini-2.0-flash",
    is_recommended: true,
    is_active: true,
    has_key: true,
    created_at: "",
    updated_at: "",
  },
];

export function useApfGenerate(moduleId?: string) {
  const { currentTeamId, user } = useAuth();
  const { sprints } = useSprint();

  const [selectedSprintId, setSelectedSprintId]     = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [allTemplates, setAllTemplates]             = useState<ApfTemplate[]>([]);
  const [generating, setGenerating]                 = useState(false);
  const [progressStep, setProgressStep]             = useState<ProgressStep>("idle");
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [lastError, setLastError]                   = useState<{ message: string; reason?: string } | null>(null);
  const [generations, setGenerations]               = useState<(ApfGeneration & { template_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory]         = useState(false);
  const [aiProviders, setAiProviders]               = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("apf_ai_api_key") || "");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [questions, setQuestions]         = useState<Question[]>([]);
  const [answers, setAnswers]             = useState<Record<string, AnswerEntry>>({});
  const [showQuestions, setShowQuestions] = useState(false);
  const [sqlFiles, setSqlFiles]           = useState<File[]>([]);
  const [currentJobId, setCurrentJobId]   = useState<string | null>(null);

  const [lastResult, setLastResult] = useState<{
    markdown: string;
    baseFilename: string;
    pfBreakdown: Record<string, number>;
    pfTotal: number | null;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ── Realtime do job via useApfJob ─────────────────────────────────
  const { job: currentJob, isDone: jobDone, isFailed: jobFailed } = useApfJob(currentJobId);

  // Reage às mudanças de status do job via Realtime
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === "processing") {
      setProgressStep("calling_ai");
    }

    if (jobDone && currentJob.result) {
      const result = currentJob.result as any;
      setLastResult({
        markdown:    result.markdown ?? "",
        baseFilename: result.outputFilename ?? "APF",
        pfBreakdown: result.pfBreakdown ?? {},
        pfTotal:     result.pfTotal ?? null,
      });
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
  }, [currentJob, jobDone, jobFailed]);

  useEffect(() => {
    if (apiKey) sessionStorage.setItem("apf_ai_api_key", apiKey);
    else sessionStorage.removeItem("apf_ai_api_key");
  }, [apiKey]);

  // Carrega todos os templates do time
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
    listAIProviders({ onlyActive: true })
      .then((list) => {
        const hasLovable = list.some((p) => p.provider_type === "lovable");
        const merged = hasLovable ? list : [...list, ...INLINE_AI_PROVIDERS];
        setAiProviders(merged);
        if (merged.length > 0) {
          const recommended = merged.find((p) => p.is_recommended) ?? merged[0];
          setSelectedProviderId((cur) => cur || recommended.id);
        }
      })
      .catch(() => {
        setAiProviders(INLINE_AI_PROVIDERS);
        setSelectedProviderId((cur) => cur || INLINE_AI_PROVIDERS[0].id);
      });
  }, []);

  useEffect(() => {
    if (!currentTeamId || !selectedSprintId) { setGenerations([]); return; }
    setLoadingHistory(true);
    fetchGenerations(currentTeamId, selectedSprintId)
      .then(setGenerations).catch(() => {}).finally(() => setLoadingHistory(false));
  }, [currentTeamId, selectedSprintId]);

  const selectedProvider = useMemo(
    () => aiProviders.find((p) => p.id === selectedProviderId) ?? null,
    [aiProviders, selectedProviderId]
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );
  const providerCfg = useMemo(() => {
    if (!selectedProvider) return { needsKey: false, placeholder: "" };
    const isLovable = selectedProvider.provider_type === "lovable";
    const needsKey = !isLovable && !selectedProvider.has_key;
    const placeholderByType: Record<string, string> = {
      openai: "sk-...", gemini: "AIza...", anthropic: "sk-ant-...", lovable: "", manus: "api-...",
    };
    return { needsKey, placeholder: placeholderByType[selectedProvider.provider_type] ?? "Cole sua API key" };
  }, [selectedProvider]);

  const canGenerate = useMemo(() => {
    if (!selectedSprintId || !selectedTemplateId) return false;
    if (!selectedProviderId) return false;
    if (providerCfg.needsKey && !apiKey.trim()) return false;
    return true;
  }, [selectedSprintId, selectedTemplateId, selectedProviderId, providerCfg.needsKey, apiKey]);

  const allQuestionsAnswered = useMemo(() => {
    if (questions.length === 0) return true;
    return questions.every((q) => {
      const a = answers[q.id];
      if (!a?.value) return false;
      if (q.kind === "yesno" && a.value === "sim" && !a.detail?.trim()) return false;
      return true;
    });
  }, [questions, answers]);

  useEffect(() => {
    if (providerCfg.needsKey) setApiKey("");
  }, [selectedProviderId, providerCfg.needsKey]);

  // ── generateGeneric: agora enfileira em vez de bloquear ─────────────────
  const generateGeneric = async (prompt: string, baseFilename: string) => {
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
      const isInlineProvider = selectedProviderId.startsWith("inline:");

      // 1. Enfileira o job (retorna imediatamente)
      setProgressStep("queued");
      const { jobId } = await enqueueApfJob(currentTeamId, {
        prompt,
        providerId: isInlineProvider ? undefined : selectedProviderId,
        provider:   isInlineProvider ? selectedProvider?.provider_type : undefined,
        apiKey:     providerCfg.needsKey ? apiKey.trim() : undefined,
        files:      [],
        skipDocx:   true,
      });

      setCurrentJobId(jobId);

      // 2. Dispara o worker (fire-and-forget)
      triggerApfWorker();

      // A partir daqui, useApfJob via Realtime dirige o estado.
      // Não chamamos setGenerating(false) aqui — o useEffect do job faz isso.
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
  };

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
    const sprintObj = (sprints ?? []).find((s) => s.id === selectedSprintId);
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
