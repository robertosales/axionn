import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ApfContext, ProjectOption, SprintOption } from "../types/apfContext.types";
import type { ContractualItem, HuRow } from "../types/apfItem.types";
import type { ApfProcessAnalysis } from "../types/apfRuntime.types";

const BATCH_SIZE = 500;
const STORY_ID_CHUNK_SIZE = 120;
const ANALYSIS_CONCURRENCY = 8;

const STORY_SELECT = "id,code,title,description,acceptance_criteria,story_points,function_points,apf_pf_bruto,apf_pf_fs,ai_fp_confidence,ai_fp_validated";
const COUNTING_ITEM_SELECT = "id,baseline_item_id,story_id,story_ids,hu_ref,ef_description,function_sigla,factor_sigla,pf_bruto,contribution_pct,pf_fs,match_type,match_confidence,ai_confidence_score,justification,evidence_literal,is_validated,corrected_function_sigla,corrected_factor_sigla,corrected_pf_bruto,corrected_pf_fs,elementary_process_id,elementary_process_key,elementary_process_name,process_role,process_is_complete,process_is_independent,counting_decision,process_reasoning,separation_precedent_ref,absorbed_by_item_id";

export function useApfCatalog(teamId: string) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [context, setContext] = useState<ApfContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [stories, setStories] = useState<HuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRequestRef = useRef(0);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [sprints, selectedSprintId],
  );

  useEffect(() => {
    let cancelled = false;

    setProjects([]);
    setProjectId("");
    setSprints([]);
    setSelectedSprintId("");
    setStories([]);
    setContext(null);
    setContextError(null);

    if (!teamId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    void Promise.all([
      supabase
        .from("projects")
        .select("id,name,contract_id")
        .eq("team_id", teamId)
        .order("name"),
      supabase
        .from("sprints")
        .select("id,name,is_active,team_id")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]).then(([projectResult, sprintResult]) => {
      if (cancelled) return;

      if (projectResult.error) {
        toast.error("Erro ao carregar projetos", {
          description: projectResult.error.message,
        });
      } else {
        const rows = (projectResult.data ?? []) as ProjectOption[];
        setProjects(rows);
        setProjectId(rows[0]?.id ?? "");
      }

      if (sprintResult.error) {
        toast.error("Erro ao carregar sprints", {
          description: sprintResult.error.message,
        });
        setLoading(false);
      } else {
        const rows = (sprintResult.data ?? []) as SprintOption[];
        setSprints(rows);
        const active = rows.find((sprint) => sprint.is_active) ?? rows[0];
        setSelectedSprintId(active?.id ?? "");
        if (!active) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      setContext(null);
      setContextError(null);
      return () => {
        cancelled = true;
      };
    }

    setContextError(null);
    void supabase
      .rpc("get_active_apf_context" as any, { p_project_id: projectId } as any)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setContext(null);
          setContextError(error.message);
        } else {
          setContext(data as unknown as ApfContext);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadStories = useCallback(async () => {
    const requestId = ++loadRequestRef.current;

    if (!teamId || !selectedSprintId) {
      setStories([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const rawStories = await fetchAllStories(teamId, selectedSprintId);
      const rows = rawStories.map((row: any) => ({
        ...row,
        acceptance_criteria: row.acceptance_criteria ?? null,
        ai_fp_confidence: row.ai_fp_confidence ?? null,
        ai_fp_validated: row.ai_fp_validated ?? false,
        _items: [],
        _analysis: null,
      })) as HuRow[];

      if (projectId && selectedSprint?.name && context?.baseline?.id) {
        const { data: session, error: sessionError } = await supabase
          .from("apf_counting_sessions" as any)
          .select("id")
          .eq("project_id", projectId)
          .eq("sprint_ref", selectedSprint.name)
          .eq("baseline_id", context.baseline.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError) throw sessionError;

        const storyById = new Map(rows.map((story) => [story.id, story]));
        const sessionId = (session as any)?.id as string | undefined;

        if (sessionId) {
          const items = await fetchAllCountingItems(sessionId);
          for (const item of items) {
            const ids = item.story_ids?.length
              ? item.story_ids
              : item.story_id
                ? [item.story_id]
                : [];

            for (const id of ids) {
              const story = storyById.get(id);
              if (story) {
                story._items.push(item);
                story._sessionId = sessionId;
              }
            }
          }
        }

        const storyIds = rows.map((story) => story.id);
        if (storyIds.length > 0) {
          const analysisRuns = await fetchAllAnalysisRuns(
            projectId,
            context.baseline.id,
            storyIds,
          );

          const latestByStory = new Map<string, string>();
          for (const run of analysisRuns) {
            if (!latestByStory.has(run.story_id)) {
              latestByStory.set(run.story_id, run.id);
            }
          }

          let analysisFailures = 0;
          await mapWithConcurrency(
            [...latestByStory.entries()],
            ANALYSIS_CONCURRENCY,
            async ([storyId, analysisId]) => {
              const { data: analysis, error } = await supabase.rpc(
                "get_apf_process_analysis" as any,
                { p_analysis_id: analysisId } as any,
              );

              if (error || !analysis) {
                analysisFailures += 1;
                return;
              }

              const story = storyById.get(storyId);
              if (story) {
                story._analysis = analysis as unknown as ApfProcessAnalysis;
              }
            },
          );

          if (analysisFailures > 0) {
            toast.warning(
              `${analysisFailures} análise${analysisFailures !== 1 ? "s" : ""} não puderam ser carregadas.`,
            );
          }
        }
      }

      if (requestId === loadRequestRef.current) setStories(rows);
    } catch (error: any) {
      if (requestId === loadRequestRef.current) {
        toast.error("Erro ao carregar HUs", {
          description: error?.message ?? "Falha inesperada.",
        });
        setStories([]);
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [
    teamId,
    selectedSprintId,
    projectId,
    selectedSprint?.name,
    context?.baseline?.id,
  ]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  return {
    projects,
    projectId,
    setProjectId,
    context,
    contextError,
    sprints,
    selectedSprintId,
    setSelectedSprintId,
    selectedSprint,
    stories,
    setStories,
    loading,
    loadStories,
  };
}

async function fetchAllStories(teamId: string, sprintId: string) {
  const rows: any[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("user_stories" as any)
      .select(STORY_SELECT)
      .eq("team_id", teamId)
      .eq("sprint_id", sprintId)
      .order("code", { ascending: true })
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}

async function fetchAllCountingItems(sessionId: string) {
  const rows: ContractualItem[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("apf_counting_items" as any)
      .select(COUNTING_ITEM_SELECT)
      .eq("session_id", sessionId)
      .order("sort_order")
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as ContractualItem[];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}

async function fetchAllAnalysisRuns(
  projectId: string,
  baselineId: string,
  storyIds: string[],
) {
  const rows: Array<{ id: string; story_id: string; created_at: string }> = [];

  for (const ids of chunk(storyIds, STORY_ID_CHUNK_SIZE)) {
    for (let from = 0; ; from += BATCH_SIZE) {
      const { data, error } = await supabase
        .from("apf_process_analysis_runs" as any)
        .select("id,story_id,status,created_at")
        .eq("project_id", projectId)
        .eq("baseline_id", baselineId)
        .in("story_id", ids)
        .in("status", ["ok", "review_required", "counted"])
        .order("created_at", { ascending: false })
        .range(from, from + BATCH_SIZE - 1);

      if (error) throw error;
      const batch = (data ?? []) as Array<{
        id: string;
        story_id: string;
        created_at: string;
      }>;
      rows.push(...batch);
      if (batch.length < BATCH_SIZE) break;
    }
  }

  return rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await task(item);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
}
