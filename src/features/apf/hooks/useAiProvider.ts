/**
 * useAiProvider
 * -------------
 * Hook utilitário que expõe o provedor ativo do AiPipelineContext
 * de forma simplificada para uso nas abas individuais.
 *
 * Cada aba (Evidências, HU, PF, Templates) usa este hook em vez de
 * gerenciar seu próprio estado de provedor — eliminando os silos de IA.
 */
import { useAiPipeline } from "../contexts/AiPipelineContext";

export function useAiProvider() {
  const {
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    selectedProvider,
    needsApiKey,
    apiKey,
    setApiKey,
    loadingProviders,
    getAiPayload,
  } = useAiPipeline();

  const providerLabel = selectedProvider?.name ?? "Selecione um provedor";
  const providerType  = selectedProvider?.provider_type ?? null;
  const model         = selectedProvider?.model ?? null;

  /** Placeholder da apiKey conforme o tipo de provedor */
  const apiKeyPlaceholder: Record<string, string> = {
    openai:    "sk-...",
    gemini:    "AIza...",
    anthropic: "sk-ant-...",
    manus:     "api-...",
    lovable:   "",
  };
  const placeholder = apiKeyPlaceholder[providerType ?? ""] ?? "Cole sua API key";

  return {
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    selectedProvider,
    needsApiKey,
    apiKey,
    setApiKey,
    loadingProviders,
    getAiPayload,
    providerLabel,
    providerType,
    model,
    placeholder,
  };
}
