import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import {
  fetchTemplates,
  fetchGenerations,
  createGeneration,
  invokeApfGeneration,
  type ApfTemplate,
  type ApfGeneration
} from "../services/apf.service";
import { listAIProviders, type AIProvider } from "@/features/admin/services/aiProviders.service";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProgressStep = "idle" | "collecting" | "calling_ai" | "saving" | "done";
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

/**
 * moduleId: UUID do módulo para filtrar templates.
 * Quando não informado, exibe todos os templates ativos (sem filtro de módulo).
 */
export function useApfGenerate(moduleId?: string) {
  const { currentTeamId, user } = useAuth();
  const { sprints } = useSprint();

  const [selectedSprintId, setSelectedSprintId]     = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [allTemplates, setAllTemplates]             = useState<ApfTemplate[]>([]);
  const [generating, setGenerating]                 = useState(false);
  const [progressStep, setProgressStep]             = useState<ProgressStep>("idle");
  const [generations, setGenerations]               = useState<(ApfGeneration & { template_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory]         = useState(false);
  const [aiProviders, setAiProviders]               = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("apf_ai_api_key") || "");
  useEffect(() => {
    if (apiKey) sessionStorage.setItem("apf_ai_api_key", apiKey);
    else sessionStorage.removeItem("apf_ai_api_key");
  }, [apiKey]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");

  const [questions, setQuestions]         = useState<Question[]>([]);
  const [answers, setAnswers]             = useState<Record<string, AnswerEntry>>({});
  const [showQuestions, setShowQuestions] = useState(false);
  const [sqlFiles, setSqlFiles]           = useState<File[]>([]);

  const [lastResult, setLastResult] = useState<{
    markdown: string;
    baseFilename: string;
    pfBreakdown: Record<string, number>;
    pfTotal: number | null;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Carrega todos os templates do time
  useEffect(() => {
    if (!currentTeamId) return;
    fetchTemplates(currentTeamId)
      .then(setAllTemplates)
      .catch(() => {});
  }, [currentTeamId]);

  /**
   * Filtra: ativos + módulo correspondente.
   * Templates sem module_id aparecem em todas as abas (retrocompatível).
   */
  const templates = useMemo(() => {
    return allTemplates.filter((t) => {
      if (!t.is_active) return false;
      if (!moduleId) return true;
      if (!t.module_id) return true; // sem módulo → aparece em todos
      return t.module_id === moduleId;
    });
  }, [allTemplates, moduleId]);

  // Carrega providers de IA
  useEffect(() => {
    listAIProviders({ onlyActive: true })
      .then((list) => {
        // Exibe TODOS os provedores ativos cadastrados no Admin → IAs
        // (Lovable, Gemini direto, OpenAI, Anthropic, Perplexity, etc.)
        // Assim o usuário pode escolher uma IA FREE (ex: Gemini com chave própria)
        // quando o provedor recomendado (Lovable) estiver sem créditos.
        const hasLovable = list.some((p) => p.provider_type === "lovable");
        const merged = hasLovable
          ? list
          : [...list, ...INLINE_AI_PROVIDERS];
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

  // Histórico de gerações
  useEffect(() => {
    if (!currentTeamId || !selectedSprintId) { setGenerations([]); return; }
    setLoadingHistory(true);
    fetchGenerations(currentTeamId, selectedSprintId)
      .then(setGenerations)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
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

  const generateGeneric = async (prompt: string, baseFilename: string) => {
    if (!currentTeamId || !user) throw new Error("Sessão inválida");
    setGenerating(true);
    setProgressStep("calling_ai");
    try {
      const isInlineProvider = selectedProviderId.startsWith("inline:");
      const result = await invokeApfGeneration({
        prompt,
        providerId: isInlineProvider ? undefined : selectedProviderId,
        provider: isInlineProvider ? selectedProvider?.provider_type : undefined,
        apiKey: providerCfg.needsKey ? apiKey.trim() : undefined,
        files: [],
        skipDocx: true,
      });
      setLastResult({
        markdown: result.markdown,
        baseFilename,
        pfBreakdown: result.pfBreakdown,
        pfTotal: result.pfTotal,
      });
      setShowPreview(true);
      setProgressStep("done");
      return result;
    } finally {
      setGenerating(false);
      setTimeout(() => setProgressStep("idle"), 2000);
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
    let prompt = selectedTemplate.prompt_template ?? "";
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
      toast.success("Documento APF gerado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar documento APF");
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
  };
}
