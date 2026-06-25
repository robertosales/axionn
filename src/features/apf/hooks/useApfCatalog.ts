import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ApfContext, ProjectOption, SprintOption } from "../types/apfContext.types";
import type { ContractualItem, HuRow } from "../types/apfItem.types";

export function useApfCatalog(teamId: string) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [context, setContext] = useState<ApfContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [stories, setStories] = useState<HuRow[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [sprints, selectedSprintId],
  );

  useEffect(() => {
    if (!teamId) return;
    supabase.from("projects").select("id,name,contract_id").eq("team_id", teamId).order("name")
      .then(({ data, error }) => {
        if (error) return toast.error("Erro ao carregar projetos", { description: error.message });
        const rows = (data ?? []) as ProjectOption[];
        setProjects(rows);
        if (rows.length) setProjectId((current) => current || rows[0].id);
      });
    supabase.from("sprints").select("id,name,is_active,team_id").eq("team_id", teamId)
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => {
        const rows = (data ?? []) as SprintOption[];
        setSprints(rows);
        const active = rows.find((sprint) => sprint.is_active) ?? rows[0];
        if (active) setSelectedSprintId((current) => current || active.id);
      });
  }, [teamId]);

  useEffect(() => {
    if (!projectId) return void setContext(null);
    setContextError(null);
    supabase.rpc("get_active_apf_context" as any, { p_project_id: projectId } as any)
      .then(({ data, error }) => {
        if (error) {
          setContext(null);
          setContextError(error.message);
        } else setContext(data as unknown as ApfContext);
      });
  }, [projectId]);

  const loadStories = useCallback(async () => {
    if (!teamId || !selectedSprintId) {
      setStories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("user_stories" as any)
      .select("id,code,title,description,acceptance_criteria,story_points,function_points,apf_pf_bruto,apf_pf_fs,ai_fp_confidence,ai_fp_validated")
      .eq("team_id", teamId).eq("sprint_id", selectedSprintId)
      .order("code", { ascending: true }).limit(250);
    if (error) {
      toast.error("Erro ao carregar HUs", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []).map((row: any) => ({
      ...row,
      acceptance_criteria: row.acceptance_criteria ?? null,
      ai_fp_confidence: row.ai_fp_confidence ?? null,
      ai_fp_validated: row.ai_fp_validated ?? false,
      _items: [],
    })) as HuRow[];

    if (projectId && selectedSprint?.name && context?.baseline?.id) {
      const { data: session } = await supabase.from("apf_counting_sessions" as any)
        .select("id")
        .eq("project_id", projectId)
        .eq("sprint_ref", selectedSprint.name)
        .eq("baseline_id", context.baseline.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if ((session as any)?.id) {
        const { data: items } = await supabase.from("apf_counting_items" as any)
          .select("id,baseline_item_id,story_id,story_ids,hu_ref,ef_description,function_sigla,factor_sigla,pf_bruto,contribution_pct,pf_fs,match_type,match_confidence,ai_confidence_score,justification,evidence_literal,is_validated,corrected_function_sigla,corrected_factor_sigla,corrected_pf_bruto,corrected_pf_fs,elementary_process_id,elementary_process_key,elementary_process_name,process_role,process_is_complete,process_is_independent,counting_decision,process_reasoning,separation_precedent_ref,absorbed_by_item_id")
          .eq("session_id", (session as any).id).order("sort_order");
        for (const item of (items ?? []) as ContractualItem[]) {
          const ids = item.story_ids?.length ? item.story_ids : item.story_id ? [item.story_id] : [];
          ids.forEach((id) => {
            const story = rows.find((entry) => entry.id === id);
            if (story) {
              story._items.push(item);
              story._sessionId = (session as any).id;
            }
          });
        }
      }
    }
    setStories(rows);
    setLoading(false);
  }, [teamId, selectedSprintId, projectId, selectedSprint?.name, context?.baseline?.id]);

  useEffect(() => { loadStories(); }, [loadStories]);

  return {
    projects, projectId, setProjectId, context, contextError,
    sprints, selectedSprintId, setSelectedSprintId, selectedSprint,
    stories, setStories, loading, loadStories,
  };
}
