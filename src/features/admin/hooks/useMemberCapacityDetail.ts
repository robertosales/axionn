import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_KANBAN_COLUMNS } from "@/types/sprint";

export interface WorkflowStatusPresentation {
  key: string;
  label: string;
  hex: string | null;
}

export interface AgilHU {
  id: string;
  title: string;
  status: string;
  status_label: string;
  status_hex: string | null;
  is_terminal: boolean;
  story_points: number | null;
  estimated_hours: number | null;
  sprint_name: string | null;
}

export interface AgilActivity {
  id: string;
  title: string;
  hours: number;
  is_closed: boolean;
  start_date: string | null;
  end_date: string | null;
  hu_title: string | null;
}

export interface SustDemanda {
  id: string;
  rhm: string;
  projeto: string;
  titulo: string | null;
  situacao: string;
  sla: string | null;
  created_at: string;
}

export interface SustHour {
  id: string;
  demanda_rhm: string;
  demanda_titulo: string | null;
  fase: string;
  horas: number;
  descricao: string;
  created_at: string;
}

interface WorkflowColumnRow {
  key: string;
  label: string;
  hex: string | null;
  dot_color: string | null;
}

interface Params {
  teamId: string;
  devId: string;
  userId?: string | null;
  module: string;
  enabled: boolean;
}

const TERMINAL_STATUS_KEYS = new Set([
  "concluido",
  "concluida",
  "done",
  "accepted",
  "aceite",
  "aceite_final",
  "ag_aceite_final",
  "pronto",
  "pronto_para_publicacao",
  "resolvido",
  "finalizado",
  "closed",
  "cancelado",
  "cancelada",
  "cancelled",
]);

export function normalizeWorkflowStatus(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function humanizeWorkflowStatus(value: string | null | undefined) {
  const normalized = normalizeWorkflowStatus(value);
  if (!normalized) return "Sem status";
  if (/^etapa_\d+$/.test(normalized)) return "Etapa não configurada";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function isTerminalWorkflowStatus(value: string | null | undefined) {
  return TERMINAL_STATUS_KEYS.has(normalizeWorkflowStatus(value));
}

export function resolveWorkflowStatus(
  value: string | null | undefined,
  columns: WorkflowColumnRow[],
): WorkflowStatusPresentation {
  const key = value ?? "";
  const custom = columns.find((column) => column.key === key);
  const fallback = DEFAULT_KANBAN_COLUMNS.find((column) => column.key === key);
  return {
    key,
    label: custom?.label || fallback?.label || humanizeWorkflowStatus(key),
    hex: custom?.hex || fallback?.hex || null,
  };
}

export function useMemberCapacityDetail({
  teamId,
  devId,
  userId,
  module,
  enabled,
}: Params) {
  const [loading, setLoading] = useState(false);
  const [hus, setHus] = useState<AgilHU[]>([]);
  const [activities, setActivities] = useState<AgilActivity[]>([]);
  const [demandas, setDemandas] = useState<SustDemanda[]>([]);
  const [hours, setHours] = useState<SustHour[]>([]);
  const [activeSprintName, setActiveSprintName] = useState<string | null>(null);
  const [noActiveSprint, setNoActiveSprint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !teamId || !devId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setNoActiveSprint(false);

      try {
        if (module === "sala_agil") {
          const [sprintResult, workflowResult] = await Promise.all([
            supabase
              .from("sprints")
              .select("id, name, start_date")
              .eq("team_id", teamId)
              .eq("is_active", true)
              .order("start_date", { ascending: false })
              .limit(1),
            supabase
              .from("workflow_columns")
              .select("key, label, hex, dot_color")
              .eq("team_id", teamId)
              .order("sort_order", { ascending: true }),
          ]);

          if (sprintResult.error) throw sprintResult.error;
          if (cancelled) return;

          const activeSprint = (sprintResult.data ?? [])[0] ?? null;
          const workflowColumns = workflowResult.error
            ? []
            : ((workflowResult.data ?? []) as WorkflowColumnRow[]);

          if (workflowResult.error) {
            console.warn(
              "[useMemberCapacityDetail] Falha ao carregar workflow_columns:",
              workflowResult.error,
            );
          }

          setActiveSprintName(activeSprint?.name ?? null);
          setNoActiveSprint(!activeSprint);

          if (!activeSprint) {
            setHus([]);
            setActivities([]);
            setDemandas([]);
            setHours([]);
            return;
          }

          const storiesResult = await supabase
            .from("user_stories")
            .select("id, title, status, story_points, estimated_hours, sprint_id")
            .eq("team_id", teamId)
            .eq("assignee_id", devId)
            .eq("sprint_id", activeSprint.id)
            .order("updated_at", { ascending: false })
            .limit(200);

          if (storiesResult.error) throw storiesResult.error;
          if (cancelled) return;

          const storyRows = (storiesResult.data ?? []) as any[];
          const storyIds = storyRows.map((story) => story.id);
          let activityRows: any[] = [];

          if (storyIds.length > 0) {
            const activitiesResult = await supabase
              .from("activities")
              .select("id, title, hours, is_closed, start_date, end_date, hu_id, hu:user_stories!activities_hu_id_fkey(title)")
              .eq("team_id", teamId)
              .eq("assignee_id", devId)
              .in("hu_id", storyIds)
              .order("end_date", { ascending: true })
              .limit(500);

            if (activitiesResult.error) throw activitiesResult.error;
            activityRows = (activitiesResult.data ?? []) as any[];
          }

          if (cancelled) return;

          setHus(storyRows.map((row) => {
            const presentation = resolveWorkflowStatus(row.status, workflowColumns);
            return {
              id: row.id,
              title: row.title,
              status: row.status,
              status_label: presentation.label,
              status_hex: presentation.hex,
              is_terminal: isTerminalWorkflowStatus(row.status),
              story_points: row.story_points,
              estimated_hours: row.estimated_hours,
              sprint_name: activeSprint.name,
            };
          }));

          setActivities(activityRows.map((row) => ({
            id: row.id,
            title: row.title,
            hours: Number(row.hours) || 0,
            is_closed: Boolean(row.is_closed),
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
            hu_title: row.hu?.title ?? null,
          })));
          setDemandas([]);
          setHours([]);
        } else {
          const responsibleUserId = userId || devId;
          const [{ data: demandData, error: demandError }, { data: hourData, error: hourError }] = await Promise.all([
            supabase
              .from("demanda_responsaveis" as any)
              .select("demanda_id, demandas:demanda_id(id, rhm, projeto, titulo, situacao, sla, created_at, team_id)")
              .eq("user_id", responsibleUserId)
              .limit(500),
            supabase
              .from("demanda_hours" as any)
              .select("id, fase, horas, descricao, created_at, demanda_id, demandas:demanda_id(rhm, titulo, team_id)")
              .eq("user_id", responsibleUserId)
              .order("created_at", { ascending: false })
              .limit(200),
          ]);

          if (demandError) throw demandError;
          if (hourError) throw hourError;
          if (cancelled) return;

          const demandasArr = ((demandData ?? []) as any[])
            .map((row) => row.demandas)
            .filter((demand) => demand && demand.team_id === teamId);

          setDemandas(demandasArr
            .filter((demand) => !["fila_concluida", "cancelada", "ag_aceite_final"].includes(demand.situacao))
            .map((demand) => ({
              id: demand.id,
              rhm: demand.rhm,
              projeto: demand.projeto,
              titulo: demand.titulo,
              situacao: demand.situacao,
              sla: demand.sla,
              created_at: demand.created_at,
            }))
            .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")));

          setHours(((hourData ?? []) as any[])
            .filter((row) => row.demandas?.team_id === teamId)
            .map((row) => ({
              id: row.id,
              fase: row.fase,
              horas: Number(row.horas) || 0,
              descricao: row.descricao,
              created_at: row.created_at,
              demanda_rhm: row.demandas?.rhm ?? "",
              demanda_titulo: row.demandas?.titulo ?? null,
            })));
          setHus([]);
          setActivities([]);
          setActiveSprintName(null);
          setNoActiveSprint(false);
        }
      } catch (caughtError: any) {
        if (!cancelled) {
          setError(caughtError?.message ?? "Erro ao carregar detalhes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId, devId, userId, module, enabled]);

  return {
    loading,
    error,
    hus,
    activities,
    demandas,
    hours,
    activeSprintName,
    noActiveSprint,
  };
}
