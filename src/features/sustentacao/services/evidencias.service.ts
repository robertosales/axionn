import { supabase } from "@/integrations/supabase/client";

export interface DemandaEvidencia {
  id: string;
  demanda_id: string;
  fase: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  url_externa: string | null;
  obrigatoria: boolean;
  user_id: string;
  created_at: string;
  profile?: { display_name: string };
}

export async function fetchEvidencias(demandaId: string): Promise<DemandaEvidencia[]> {
  const { data, error } = await supabase
    .from("demanda_evidencias" as any)
    .select("*")
    .eq("demanda_id", demandaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  
  const items = (data || []) as unknown as DemandaEvidencia[];
  // Fetch profiles
  const userIds = [...new Set(items.map(i => i.user_id))];
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    const map = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]));
    items.forEach(i => { i.profile = { display_name: map.get(i.user_id) || 'Usuário' }; });
  }
  return items;
}

export async function addEvidencia(params: {
  demanda_id: string;
  fase: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  file_path?: string;
  file_name?: string;
  mime_type?: string;
  url_externa?: string;
  user_id: string;
}) {
  const { error } = await supabase.from("demanda_evidencias" as any).insert(params as any);
  if (error) throw error;
}

export async function removeEvidencia(id: string) {
  const { error } = await supabase.from("demanda_evidencias" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function uploadEvidenciaFile(file: File, demandaId: string): Promise<{ path: string }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Usuário não autenticado");
  const ext = file.name.split('.').pop();
  const path = `${authData.user.id}/evidencias/${demandaId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file);
  if (error) throw error;
  return { path };
}

export async function getEvidenciaSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(filePath, 300);
  if (error) return null;
  return data.signedUrl;
}

// Evolução 8: Evidência obrigatória APENAS para avançar para "planejamento"
// As demais fases permitem anexo para rastreabilidade, mas sem bloqueio.
export const EVIDENCIAS_OBRIGATORIAS: Record<string, string[]> = {};

// Evidências condicionais por tipo de demanda (informativas, sem bloqueio)
export const EVIDENCIAS_CONDICIONAIS: Record<string, Record<string, string[]>> = {};
