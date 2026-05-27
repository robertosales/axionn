import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import {
  fetchActiveTemplates,
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

const INLINE_AI_PROVIDERS: AIProvider[] = [
  { id: "inline:lovable", name: "Lovable AI (Gratuita) — recomendada", provider_type: "lovable", model: "google/gemini-2.0-flash", is_recommended: true, is_active: true, has_key: true, created_at: "", updated_at: "" },
];

export function useApfGenerate() {
  const { currentTeamId, user } = useAuth();
  const { sprints } = useSprint();

  const [selectedSprintId, setSelectedSprintId]     = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates]                   = useState<ApfTemplate[]>([]);
  const [generating, setGenerating]                 = useState(false);
  const [progressStep, setProgressStep]             = useState<ProgressStep>("idle");
  const [generations, setGenerations]               = useState<(ApfGeneration & { template_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory]         = useState(false);
  const [aiProviders, setAiProviders]               = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKey, setApiKey]                         = useState("");
  const [outputFormat, setOutputFormat]             = useState<OutputFormat>("docx");

  const [lastResult, setLastResult] = useState<{
    markdown: string;
    baseFilename: string;
    pfBreakdown: Record<string, number>;
    pfTotal: number | null;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load templates
  useEffect(() => {
    if (!currentTeamId) return;
    fetchActiveTemplates(currentTeamId).then(setTemplates).catch(() => {});
  }, [currentTeamId]);

  // Load providers
  useEffect(() => {
    listAIProviders({ onlyActive: true })
      .then((list) => {
        const freeFromDb = list.filter((p) => p.provider_type === "lovable");
        const merged = [
          ...freeFromDb,
          ...INLINE_AI_PROVIDERS.filter((inline) => !freeFromDb.some((p) => p.provider_type === inline.provider_type)),
        ];
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

  // Load history
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
    [aiProviders, selectedProviderId],
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

  // Reset API key when provider changes (unless it's the same type)
  useEffect(() => {
    // Optional: Only clear if switching to a provider that needs a key
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

  return {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates,
    aiProviders,
    selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    outputFormat, setOutputFormat,
    generating,
    progressStep,
    generations, loadingHistory,
    lastResult, setLastResult,
    showPreview, setShowPreview,
    generateGeneric,
    providerCfg
  };
}
