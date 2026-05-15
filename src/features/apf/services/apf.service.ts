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
  status: "pending" | "success" | "error";
  error_message: string | null;
  pf_total?: number | null;
  pf_breakdown?: Record<string, number> | null;
  created_at: string;
}

// ─── Extensões que podem ser lidas como texto puro ───
const TEXT_EXTENSIONS = [".md", ".txt", ".csv", ".json", ".xml", ".html", ".htm"];

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  if (file.type.startsWith("text/")) return true;
  return false;
}

/**
 * Converte um arquivo para a representação que a Edge Function espera:
 * - Arquivos de texto: envia o conteúdo bruto (truncado em 50 KB)
 * - Arquivos binários (xlsx, docx, pdf): envia base64 com prefixo data-URI
 *   para que a Edge Function possa identificá-los e processar adequadamente.
 */
async function fileToPayload(file: File): Promise<{ name: string; content: string }> {
  if (isTextFile(file)) {
    try {
      const text = await file.text();
      const truncated = text.length > 50_000 ? text.slice(0, 50_000) + "\n[... conteúdo truncado ...]" : text;
      return { name: file.name, content: truncated };
    } catch {
      return { name: file.name, content: `[Não foi possível ler ${file.name}]` };
    }
  }

  // Binário → base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      resolve({ name: file.name, content: result });
    };
    reader.onerror = () => {
      resolve({
        name: file.name,
        content: `[Arquivo binário não legível: ${file.name} — ${(file.size / 1024).toFixed(1)} KB]`,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Prepara todos os arquivos para envio à Edge Function.
 * Exportado para uso no hook useApfGenerate.
 */
export async function prepareFilesForEdgeFunction(
  files: File[],
): Promise<Array<{ name: string; content: string }>> {
  return Promise.all(files.map(fileToPayload));
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
  sprintId: string,
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
 * Invoca a Edge Function `apf-generate`.
 * Passa generationId para que a função possa atualizar o registro após gerar.
 */
export async function invokeApfGeneration(body: {
  prompt: string;
  provider: string;
  apiKey?: string;
  files: Array<{ name: string; content: string }>;
  generationId?: string;
}): Promise<{
  docxBase64: string;
  markdown: string;
  pfTotal: number | null;
  pfBreakdown: Record<string, number>;
}> {
  const { data, error } = await supabase.functions.invoke("apf-generate", { body });
  if (error) throw new Error(error.message ?? "Erro ao chamar a IA");
  if (!data?.success || !data?.docxBase64) {
    throw new Error(data?.error ?? "A IA não retornou conteúdo");
  }
  return {
    docxBase64:  data.docxBase64,
    markdown:    data.markdown ?? "",
    pfTotal:     data.pfTotal   ?? null,
    pfBreakdown: data.pfBreakdown ?? {},
  };
}
