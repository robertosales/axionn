/**
 * AiPipelineContext (v2 — Fase 4)
 * ---------------------------------
 * Adiciona suporte ao Aprendizado Bidirecional:
 *  - calibrationContext: string gerado pelo useLearningInsights
 *  - setCalibrationContext: gravado pelo hook após computar insights
 *  - getAiPayload(): agora inclui calibrationContext nas chamadas de IA
 */
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { listAIProviders, type AIProvider } from "@/features/admin/services/aiProviders.service";

const INLINE_LOVABLE: AIProvider = {
  id: "inline:lovable",
  name: "Lovable AI (Gratuita) — recomendada",
  provider_type: "lovable",
  model: "google/gemini-2.0-flash",
  api_base_url: "https://ai.gateway.lovable.dev/v1/chat/completions",
  request_format: "openai_compatible",
  is_recommended: true,
  is_active: true,
  has_key: true,
  created_at: "",
  updated_at: "",
};

export interface AiPipelineState {
  // ── Provedor ────────────────────────────────────────────────────────────
  aiProviders: AIProvider[];
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedProvider: AIProvider | null;
  needsApiKey: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;

  // ── Sprint compartilhada ────────────────────────────────────────────────
  activePipelineSprintId: string;
  setActivePipelineSprintId: (id: string) => void;

  // ── IDs de rastreabilidade ──────────────────────────────────────────────
  lastHuGenerationId: string | null;
  setLastHuGenerationId: (id: string | null) => void;
  lastPfAnalysisId: string | null;
  setLastPfAnalysisId: (id: string | null) => void;

  // ── Fase 4: Aprendizado Bidirecional ───────────────────────────────────
  /** Texto gerado pelo computeLearningInsights injetado antes dos prompts de PF */
  calibrationContext: string;
  setCalibrationContext: (ctx: string) => void;
  /** true quando há calibração suficiente (>= 3 validações) */
  isCalibrated: boolean;

  // ── Helpers ─────────────────────────────────────────────────────────────
  loadingProviders: boolean;
  getAiPayload: () => {
    providerId: string | undefined;
    provider: string | undefined;
    apiKey: string | undefined;
    calibrationContext: string | undefined;
  };
}

const AiPipelineContext = createContext<AiPipelineState | null>(null);

export function AiPipelineProvider({ children }: { children: ReactNode }) {
  const [aiProviders, setAiProviders]               = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [apiKey, setApiKey]                         = useState(() => sessionStorage.getItem("apf_ai_api_key") || "");
  const [loadingProviders, setLoadingProviders]     = useState(true);
  const [activePipelineSprintId, setActivePipelineSprintId] = useState("");
  const [lastHuGenerationId, setLastHuGenerationId] = useState<string | null>(null);
  const [lastPfAnalysisId, setLastPfAnalysisId]     = useState<string | null>(null);
  const [calibrationContext, setCalibrationContext] = useState("");

  useEffect(() => {
    if (apiKey) sessionStorage.setItem("apf_ai_api_key", apiKey);
    else sessionStorage.removeItem("apf_ai_api_key");
  }, [apiKey]);

  useEffect(() => {
    setLoadingProviders(true);
    listAIProviders({ onlyActive: true })
      .then((list) => {
        const hasLovable = list.some((p) => p.provider_type === "lovable");
        const merged = hasLovable ? list : [...list, INLINE_LOVABLE];
        setAiProviders(merged);
        if (!selectedProviderId) {
          const recommended = merged.find((p) => p.is_recommended) ?? merged[0];
          if (recommended) setSelectedProviderId(recommended.id);
        }
      })
      .catch(() => {
        setAiProviders([INLINE_LOVABLE]);
        if (!selectedProviderId) setSelectedProviderId(INLINE_LOVABLE.id);
      })
      .finally(() => setLoadingProviders(false));
  }, []);

  const selectedProvider = useMemo(
    () => aiProviders.find((p) => p.id === selectedProviderId) ?? null,
    [aiProviders, selectedProviderId]
  );

  const needsApiKey = useMemo(() => {
    if (!selectedProvider) return false;
    return selectedProvider.provider_type !== "lovable" && !selectedProvider.has_key;
  }, [selectedProvider]);

  useEffect(() => {
    if (!needsApiKey) setApiKey("");
  }, [selectedProviderId, needsApiKey]);

  const isCalibrated = calibrationContext.trim().length > 0;

  const getAiPayload = () => {
    const isInline = selectedProviderId.startsWith("inline:");
    return {
      providerId:         isInline ? undefined : selectedProviderId,
      provider:           isInline ? selectedProvider?.provider_type : undefined,
      apiKey:             needsApiKey ? apiKey.trim() : undefined,
      // Fase 4: calibração hiistórica injetada automaticamente
      calibrationContext: isCalibrated ? calibrationContext : undefined,
    };
  };

  const value: AiPipelineState = {
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    selectedProvider,
    needsApiKey,
    apiKey,
    setApiKey,
    activePipelineSprintId,
    setActivePipelineSprintId,
    lastHuGenerationId,
    setLastHuGenerationId,
    lastPfAnalysisId,
    setLastPfAnalysisId,
    calibrationContext,
    setCalibrationContext,
    isCalibrated,
    loadingProviders,
    getAiPayload,
  };

  return <AiPipelineContext.Provider value={value}>{children}</AiPipelineContext.Provider>;
}

export function useAiPipeline(): AiPipelineState {
  const ctx = useContext(AiPipelineContext);
  if (!ctx) throw new Error("useAiPipeline deve ser usado dentro de <AiPipelineProvider>");
  return ctx;
}
