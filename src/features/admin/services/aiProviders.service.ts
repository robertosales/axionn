import { supabase } from "@/integrations/supabase/client";

// ProviderType é agora string livre — não mais union hard-coded
// Novos providers cadastrados no admin funcionam sem deploy
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

export async function listAIProviders(opts: { onlyActive?: boolean } = {}): Promise<AIProvider[]> {
  let q = supabase
    .from("ai_providers" as any)
    .select("*")
    .order("is_recommended", { ascending: false })
    .order("name");
  if (opts.onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AIProvider[];
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
  const { data, error } = await supabase
    .from("ai_providers" as any)
    .insert(payload as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AIProvider;
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
  const { error } = await supabase
    .from("ai_providers" as any)
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAIProvider(id: string): Promise<void> {
  await supabase.rpc("delete_ai_provider_key" as any, { p_id: id } as any);
  const { error } = await supabase
    .from("ai_providers" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setAIProviderKey(id: string, key: string): Promise<void> {
  const { error } = await supabase.rpc("set_ai_provider_key_v2" as any, { p_id: id, p_key: key } as any);
  if (error) throw error;
}

/** Lista os request_format disponíveis para o formulário */
export const REQUEST_FORMAT_OPTIONS: Array<{ value: "openai_compatible" | "gemini" | "anthropic"; label: string }> = [
  { value: "openai_compatible", label: "OpenAI-compatible (Groq, Perplexity, Sakana, etc.)" },
  { value: "gemini",            label: "Google Gemini" },
  { value: "anthropic",         label: "Anthropic Claude" },
];
