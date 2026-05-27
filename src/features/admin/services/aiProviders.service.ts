import { supabase } from "@/integrations/supabase/client";

export type ProviderType = "lovable" | "openai" | "gemini" | "anthropic" | "perplexity" | "manus";

export interface AIProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  model: string | null;
  is_recommended: boolean;
  is_active: boolean;
  has_key: boolean;
  created_at: string;
  updated_at: string;
}

export const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = {
  lovable: "Lovable AI (Gemini/GPT)",
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
  perplexity: "Perplexity",
  manus: "Manus AI",
};

export async function listAIProviders(opts: { onlyActive?: boolean } = {}): Promise<AIProvider[]> {
  let q = supabase.from("ai_providers" as any).select("*").order("is_recommended", { ascending: false }).order("name");
  if (opts.onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AIProvider[];
}

export async function createAIProvider(payload: {
  name: string;
  provider_type: ProviderType;
  model?: string | null;
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

export async function updateAIProvider(id: string, patch: Partial<{
  name: string;
  provider_type: ProviderType;
  model: string | null;
  is_recommended: boolean;
  is_active: boolean;
}>): Promise<void> {
  const { error } = await supabase.from("ai_providers" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteAIProvider(id: string): Promise<void> {
  await supabase.rpc("delete_ai_provider_key" as any, { p_id: id } as any);
  const { error } = await supabase.from("ai_providers" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function setAIProviderKey(id: string, key: string): Promise<void> {
  const { error } = await supabase.rpc("set_ai_provider_key_v2" as any, { p_id: id, p_key: key } as any);
  if (error) throw error;
}
