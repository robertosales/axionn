import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SalaAgilRelatorios } from "@/components/sala-agil/reports/SalaAgilRelatorios";

/**
 * Página dedicada de Relatórios — Sala Ágil.
 * Carrega o dataset do time ativo e renderiza o catálogo de relatórios.
 */
export function SalaAgilReportsPage() {
  const { teams, currentTeamId, user, isAdmin } = useAuth();
  const agileTeams = useMemo(
    () => teams.filter((t: any) => t.module === "sala_agil"),
    [teams],
  );
  const currentTeam = agileTeams.find((t: any) => t.id === currentTeamId);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    sprints: [] as any[],
    hus: [] as any[],
    activities: [] as any[],
    impediments: [] as any[],
    developers: [] as any[],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const teamsToLoad = isAdmin && !currentTeamId
        ? agileTeams
        : agileTeams.filter((t: any) => t.id === currentTeamId);
      if (teamsToLoad.length === 0) {
        setData({ sprints: [], hus: [], activities: [], impediments: [], developers: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      const allSprints: any[] = [];
      const allHUs: any[] = [];
      const allActs: any[] = [];
      const allImps: any[] = [];
      const allDevs: any[] = [];
      for (const team of teamsToLoad) {
        const [sR, hR, aR, iR, dR] = await Promise.all([
          supabase.from("sprints").select("*").eq("team_id", team.id),
          supabase.from("user_stories").select("*").eq("team_id", team.id),
          supabase.from("activities").select("*").eq("team_id", team.id),
          supabase.from("impediments").select("*").eq("team_id", team.id),
          supabase.from("developers").select("*").eq("team_id", team.id),
        ]);
        allSprints.push(...(sR.data || []));
        allHUs.push(...(hR.data || []));
        allActs.push(...(aR.data || []));
        allImps.push(...(iR.data || []));
        allDevs.push(...(dR.data || []));
      }
      if (cancelled) return;
      setData({
        sprints: allSprints, hus: allHUs, activities: allActs,
        impediments: allImps, developers: allDevs,
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [currentTeamId, agileTeams, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success" />
      </div>
    );
  }

  return (
    <SalaAgilRelatorios
      sprints={data.sprints.map((s: any) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
      developers={data.developers.map((d: any) => ({
        id: d.id, name: d.name, role: d.role || "developer", user_id: d.user_id,
      })) as any}
      rawData={data}
      teamName={currentTeam?.name ?? "Todos os times"}
      currentUserName={(user as any)?.user_metadata?.name ?? (user as any)?.email ?? "Usuário"}
    />
  );
}