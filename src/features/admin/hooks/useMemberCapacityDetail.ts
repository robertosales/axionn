import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgilHU {
  id: string;
  title: string;
  status: string;
  story_points: number | null;
  estimated_hours: number | null;
  sprint_name: string | null;
}
export interface AgilActivity {
  id: string;
  title: string;
  hours: number;
  is_closed: boolean;
  start_date: string;
  end_date: string;
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

interface Params {
  teamId: string;
  devId: string;
  module: string; // "sala_agil" | "sustentacao"
  enabled: boolean;
}

export function useMemberCapacityDetail({ teamId, devId, module, enabled }: Params) {
  const [loading, setLoading] = useState(false);
  const [hus, setHus]               = useState<AgilHU[]>([]);
  const [activities, setActivities] = useState<AgilActivity[]>([]);
  const [demandas, setDemandas]     = useState<SustDemanda[]>([]);
  const [hours, setHours]           = useState<SustHour[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !teamId || !devId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (module === "sala_agil") {
          const [{ data: usData, error: e1 }, { data: actData, error: e2 }] = await Promise.all([
            supabase
              .from("user_stories")
              .select("id, title, status, story_points, estimated_hours, sprint_id, sprints(name, is_active)")
              .eq("team_id", teamId)
              .eq("assignee_id", devId)
              .order("updated_at", { ascending: false })
              .limit(200),
            supabase
              .from("activities")
              .select("id, title, hours, is_closed, start_date, end_date, hu_id, user_stories(title)")
              .eq("team_id", teamId)
              .eq("assignee_id", devId)
              .order("end_date", { ascending: true })
              .limit(200),
          ]);
          if (e1) throw e1;
          if (e2) throw e2;
          if (cancelled) return;
          setHus(((usData ?? []) as any[]).map(r => ({
            id: r.id, title: r.title, status: r.status,
            story_points: r.story_points, estimated_hours: r.estimated_hours,
            sprint_name: r.sprints?.name ?? null,
          })));
          setActivities(((actData ?? []) as any[]).map(r => ({
            id: r.id, title: r.title, hours: r.hours, is_closed: r.is_closed,
            start_date: r.start_date, end_date: r.end_date,
            hu_title: r.user_stories?.title ?? null,
          })));
          setDemandas([]); setHours([]);
        } else {
          const [{ data: dResp, error: e1 }, { data: hData, error: e2 }] = await Promise.all([
            supabase
              .from("demanda_responsaveis" as any)
              .select("demanda_id, demandas:demanda_id(id, rhm, projeto, titulo, situacao, sla, created_at, team_id)")
              .eq("user_id", devId)
              .limit(500),
            supabase
              .from("demanda_hours" as any)
              .select("id, fase, horas, descricao, created_at, demanda_id, demandas:demanda_id(rhm, titulo, team_id)")
              .eq("user_id", devId)
              .order("created_at", { ascending: false })
              .limit(200),
          ]);
          if (e1) throw e1;
          if (e2) throw e2;
          if (cancelled) return;

          const demandasArr = (((dResp ?? []) as any[])
            .map(r => r.demandas)
            .filter(d => d && d.team_id === teamId)) as any[];
          setDemandas(demandasArr
            .filter(d => !["fila_concluida","cancelada","ag_aceite_final"].includes(d.situacao))
            .map(d => ({
              id: d.id, rhm: d.rhm, projeto: d.projeto, titulo: d.titulo,
              situacao: d.situacao, sla: d.sla, created_at: d.created_at,
            }))
            .sort((a,b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
          );
          setHours(((hData ?? []) as any[])
            .filter(r => r.demandas?.team_id === teamId)
            .map(r => ({
              id: r.id, fase: r.fase, horas: Number(r.horas) || 0, descricao: r.descricao,
              created_at: r.created_at,
              demanda_rhm: r.demandas?.rhm ?? "",
              demanda_titulo: r.demandas?.titulo ?? null,
            }))
          );
          setHus([]); setActivities([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erro ao carregar detalhes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, devId, module, enabled]);

  return { loading, error, hus, activities, demandas, hours };
}