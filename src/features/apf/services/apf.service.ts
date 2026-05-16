import { supabase } from "@/integrations/supabase/client";

export interface ApfTemplate {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  output_type: "docx" | "xlsx";
  prompt_content: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApfGeneration {
  id: string;
  team_id: string;
  template_id: string | null;
  sprint_id: string | null;
  generated_by: string | null;
  baseline_file: string | null;
  hu_file: string | null;
  model_file: string | null;
  output_filename: string | null;
  output_markdown: string | null;  // novo
  pf_total: number | null;         // novo
  pf_breakdown: Record<string, number> | null; // novo
  storage_path: string | null;     // novo
  status: "pending" | "success" | "error";
  error_message: string | null;
  created_at: string;
}

// Converte File do browser para base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Detecta se o arquivo precisa ser enviado como base64
export function isBinaryFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") ||
         lower.endsWith(".docx") || lower.endsWith(".doc") ||
         lower.endsWith(".pdf");
}

export async function fetchTemplates(teamId: string): Promise<ApfTemplate[]> {
  const { data, error } = await supabase
    .from("apf_templates")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApfTemplate[];
}

export async function fetchActiveTemplates(teamId: string): Promise<ApfTemplate[]> {
  const { data, error } = await supabase
    .from("apf_templates")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ApfTemplate[];
}

export async function createTemplate(
  teamId: string,
  userId: string,
  payload: { name: string; description?: string; output_type: string; prompt_content: string }
): Promise<ApfTemplate> {
  const { data, error } = await supabase
    .from("apf_templates")
    .insert({ ...payload, team_id: teamId, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as ApfTemplate;
}

export async function updateTemplate(
  id: string,
  currentVersion: number,
  payload: { name: string; description?: string; output_type: string; prompt_content: string }
): Promise<ApfTemplate> {
  const { data, error } = await supabase
    .from("apf_templates")
    .update({ ...payload, version: currentVersion + 1 })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ApfTemplate;
}

export async function duplicateTemplate(template: ApfTemplate): Promise<ApfTemplate> {
  const { data, error } = await supabase
    .from("apf_templates")
    .insert({
      team_id: template.team_id,
      name: `${template.name} (cópia)`,
      description: template.description,
      output_type: template.output_type,
      prompt_content: template.prompt_content,
      created_by: template.created_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ApfTemplate;
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("apf_templates").update({ is_active: !isActive }).eq("id", id);
  if (error) throw error;
}

export async function fetchGenerations(
  teamId: string,
  sprintId: string
): Promise<(ApfGeneration & { template_name?: string })[]> {
  const { data, error } = await supabase
    .from("apf_generations")
    .select("*, apf_templates(name)")
    .eq("team_id", teamId)
    .eq("sprint_id", sprintId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((g: any) => ({
    ...g,
    template_name: g.apf_templates?.name ?? "Template removido",
  }));
}

export async function createGeneration(payload: {
  team_id: string;
  template_id: string;
  sprint_id: string;
  generated_by: string;
  baseline_file: string;
  hu_file: string;
  model_file: string;
  output_filename: string;
  status: string;
}): Promise<ApfGeneration> {
  const { data, error } = await supabase
    .from("apf_generations")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ApfGeneration;
}

/**
 * Retorna a URL públicaa (signed) de um arquivo gerado no Storage
 */
export async function getGenerationDownloadUrl(
  storagePath: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("apf-documents")
    .createSignedUrl(storagePath, 60 * 60); // 1 hora
  return data?.signedUrl ?? null;
}

/**
 * Prepara os arquivos do browser para envio à Edge Function.
 * Arquivos binários (xlsx, docx, pdf) são convertidos para base64.
 * Arquivos de texto são lidos como string.
 */
export async function prepareFilesForEdgeFunction(
  files: File[]
): Promise<Array<{ name: string; content: string; encoding: "base64" | "text"; mimeType: string }>> {
  const result = [];
  for (const file of files) {
    const binary = isBinaryFile(file.name);
    if (binary) {
      const base64 = await fileToBase64(file);
      result.push({
        name: file.name,
        content: base64,
        encoding: "base64" as const,
        mimeType: file.type || "application/octet-stream",
      });
    } else {
      const text = await file.text();
      result.push({
        name: file.name,
        content: text,
        encoding: "text" as const,
        mimeType: file.type || "text/plain",
      });
    }
  }
  return result;
}

/**
 * Invoca a Edge Function `apf-generate`.
 * - Envia arquivos binários como base64
 * - Passa generationId para persistência automática no banco
 * - Retorna pfBreakdown e pfTotal além do docx e markdown
 */
export async function invokeApfGeneration(body: {
  prompt: string;
  provider: string;
  apiKey?: string;
  files: Array<{ name: string; content: string; encoding?: "base64" | "text"; mimeType?: string }>;
  generationId?: string;
}): Promise<{
  docxBase64: string;
  markdown: string;
  pfBreakdown: Record<string, number>;
  pfTotal: number | null;
  outputFilename: string;
}> {
  const supabaseUrl = (supabase as any).supabaseUrl as string | undefined;
  const { data, error } = await supabase.functions.invoke("apf-generate", {
    body: {
      ...body,
      supabaseUrl,
      // service key não fica no cliente — a Edge Function usa SUPABASE_SERVICE_ROLE_KEY do env
    },
  });
  if (error) throw new Error(error.message ?? "Erro ao chamar a IA");
  if (!data?.success || !data?.docxBase64) {
    throw new Error(data?.error ?? "A IA não retornou conteúdo");
  }
  return {
    docxBase64: data.docxBase64,
    markdown: data.markdown ?? "",
    pfBreakdown: data.pfBreakdown ?? {},
    pfTotal: data.pfTotal ?? null,
    outputFilename: data.outputFilename ?? "Evidencia_APF.docx",
  };
}
