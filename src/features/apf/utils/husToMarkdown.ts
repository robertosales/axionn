import { supabase } from "@/integrations/supabase/client";

export interface HuLite {
  code: string;
  title: string;
  description: string | null;
  story_points: number | null;
  function_points: number | null;
}

/** Busca HUs de uma sprint e devolve em formato markdown enxuto. */
export async function fetchSprintHusAsMarkdown(sprintId: string): Promise<{ markdown: string; count: number }> {
  const { data, error } = await supabase
    .from("user_stories")
    .select("code,title,description,story_points,function_points")
    .eq("sprint_id", sprintId)
    .order("position", { ascending: true });

  if (error) throw error;
  const hus = (data ?? []) as HuLite[];

  if (hus.length === 0) {
    return { markdown: "_(Nenhuma HU encontrada nesta sprint)_", count: 0 };
  }

  const lines: string[] = [];
  for (const hu of hus) {
    lines.push(`### ${hu.code} — ${hu.title}`);
    if (hu.story_points || hu.function_points) {
      const meta: string[] = [];
      if (hu.story_points) meta.push(`SP: ${hu.story_points}`);
      if (hu.function_points) meta.push(`PF estimado: ${hu.function_points}`);
      lines.push(`*${meta.join(" • ")}*`);
    }
    const desc = (hu.description ?? "").trim();
    lines.push(desc ? desc : "_(sem descrição)_");
    lines.push("");
  }
  return { markdown: lines.join("\n"), count: hus.length };
}