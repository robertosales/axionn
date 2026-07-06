import { supabase } from "@/integrations/supabase/client";

export type ProviderType = string;

export interface AIProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  model: string | null;
  api_base_url: string | null;
  request_format: "openai_compatible" | "gemini" | "anthropic" | null;
  is_recommended: boolean;
  is_active: boolean;
  has_key: boolean;
  created_at: string;
  updated_at: string;
}

function normalizeProvider(row: Record<string, unknown>): AIProvider {
  return {
    id: String(row.id),
    name: String(row.name ?? "Provedor"),
    provider_type: String(row.provider_type ?? ""),
    model: row.model ? String(row.model) : null,
    api_base_url: row.api_base_url ? String(row.api_base_url) : null,
    request_format: row.request_format
      ? (String(row.request_format) as AIProvider["request_format"])
      : null,
    is_recommended: Boolean(row.is_recommended),
    is_active: Boolean(row.is_active),
    has_key: Boolean(row.has_key),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listAIProviders(
  opts: { onlyActive?: boolean } = {},
): Promise<AIProvider[]> {
  const { data, error } = await (supabase as any).rpc(
    "list_platform_ai_providers_v2",
    { p_only_active: Boolean(opts.onlyActive) },
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeProvider);
}

export async function createAIProvider(payload: {
  name: string;
  provider_type: ProviderType;
  model?: string | null;
  api_base_url?: string | null;
  request_format?: "openai_compatible" | "gemini" | "anthropic" | null;
  is_recommended?: boolean;
  is_active?: boolean;
}): Promise<AIProvider> {
  const { data: id, error } = await (supabase as any).rpc(
    "create_platform_ai_provider_v2",
    {
      p_name: payload.name,
      p_provider_type: payload.provider_type,
      p_model: payload.model ?? null,
      p_api_base_url: payload.api_base_url ?? null,
      p_request_format: payload.request_format ?? "openai_compatible",
      p_is_recommended: Boolean(payload.is_recommended),
      p_is_active: payload.is_active ?? true,
    },
  );
  if (error) throw error;

  const providers = await listAIProviders();
  const created = providers.find((provider) => provider.id === String(id));
  if (!created) throw new Error("Provedor criado, mas não foi possível recarregá-lo.");
  return created;
}

export async function updateAIProvider(
  id: string,
  patch: Partial<{
    name: string;
    provider_type: ProviderType;
    model: string | null;
    api_base_url: string | null;
    request_format: "openai_compatible" | "gemini" | "anthropic" | null;
    is_recommended: boolean;
    is_active: boolean;
  }>,
): Promise<void> {
  const current = (await listAIProviders()).find((provider) => provider.id === id);
  if (!current) throw new Error("Provedor não encontrado.");

  const { error } = await (supabase as any).rpc(
    "update_platform_ai_provider_v2",
    {
      p_provider_id: id,
      p_name: patch.name ?? current.name,
      p_provider_type: patch.provider_type ?? current.provider_type,
      p_model: patch.model === undefined ? current.model : patch.model,
      p_api_base_url:
        patch.api_base_url === undefined ? current.api_base_url : patch.api_base_url,
      p_request_format:
        patch.request_format === undefined
          ? current.request_format ?? "openai_compatible"
          : patch.request_format ?? "openai_compatible",
      p_is_recommended: patch.is_recommended ?? current.is_recommended,
      p_is_active: patch.is_active ?? current.is_active,
    },
  );
  if (error) throw error;
}

export async function deleteAIProvider(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc(
    "archive_platform_ai_provider_v2",
    { p_provider_id: id },
  );
  if (error) throw error;
}

export async function setAIProviderKey(id: string, key: string): Promise<void> {
  const { error } = await (supabase as any).rpc(
    "set_platform_ai_provider_key_v2",
    { p_provider_id: id, p_key: key },
  );
  if (error) throw error;
}

export const REQUEST_FORMAT_OPTIONS: Array<{
  value: "openai_compatible" | "gemini" | "anthropic";
  label: string;
}> = [
  {
    value: "openai_compatible",
    label: "OpenAI-compatible (Groq, Perplexity, Sakana, etc.)",
  },
  { value: "gemini", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic Claude" },
];
