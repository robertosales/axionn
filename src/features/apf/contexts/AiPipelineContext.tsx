/**
 * AiPipelineContext
 * -----------------
 * Contexto global da feature APF que compartilha:
 *  - Provedor de IA selecionado (único para todas as abas)
 *  - Sprint ativa (todas as abas operam na mesma sprint)
 *  - hu_generation_id gerada na aba HU (usado pela aba PF e Evidências)
 *  - pf_analysis_id gerado na aba PF (usado pela aba Evidências)
 *
 * Isso elimina o problema de silos: cada aba lia o provedor de forma isolada.
 */
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { listAIProviders, type AIProvider } from "@/features/admin/services/aiProviders.service";

const INLINE_LOVABLE: AIProvider = {
  id: "inline:lovable",
  name: "Lovable AI (Gratuita) — recomendada",
  provider_type: "lovable",
  model: "google/gemini-2.0-flash",
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
  /** true quando o provedor selecionado exige apiKey manual */
  needsApiKey: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;

  // ── Sprint compartilhada ────────────────────────────────────────────────
  activePipelineSprintId: string;
  setActivePipelineSprintId: (id: string) => void;

  // ── IDs de rastreabilidade (HU → PF → Evidência) ────────────────────────
  /** ID da última HU gerada na aba "Gerar HU" */
  lastHuGenerationId: string | null;
  setLastHuGenerationId: (id: string | null) => void;

  /** ID da última análise de PF gerada na aba "Contagem por Sprint" */
  lastPfAnalysisId: string | null;
  setLastPfAnalysisId: (id: string | null) => void;

  // ── Helpers ─────────────────────────────────────────────────────────────
  loadingProviders: boolean;
  /** Retorna headers/body base para chamar qualquer Edge Function de IA */
  getAiPayload: () => { providerId: string | undefined; provider: string | undefined; apiKey: string | undefined };
}

const AiPipelineContext = createContext<AiPipelineState | null>(null);

export function AiPipelineProvider({ children }: { children: ReactNode }) {
  const [aiProviders, setAiProviders]             = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [apiKey, setApiKey]                        = useState(() => sessionStorage.getItem("apf_ai_api_key") || "");
  const [loadingProviders, setLoadingProviders]    = useState(true);
  const [activePipelineSprintId, setActivePipelineSprintId] = useState("");
  const [lastHuGenerationId, setLastHuGenerationId] = useState<string | null>(null);
  const [lastPfAnalysisId, setLastPfAnalysisId]     = useState<string | null>(null);

  // Persiste apiKey manual na sessão
  useEffect(() => {
    if (apiKey) sessionStorage.setItem("apf_ai_api_key", apiKey);
    else sessionStorage.removeItem("apf_ai_api_key");
  }, [apiKey]);

  // Carrega provedores ativos do Hub de IA
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

  // Limpa apiKey quando muda para provedor que não precisa
  useEffect(() => {
    if (!needsApiKey) setApiKey("");
  }, [selectedProviderId, needsApiKey]);

  const getAiPayload = () => {
    const isInline = selectedProviderId.startsWith("inline:");
    return {
      providerId: isInline ? undefined : selectedProviderId,
      provider:   isInline ? selectedProvider?.provider_type : undefined,
      apiKey:     needsApiKey ? apiKey.trim() : undefined,
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
