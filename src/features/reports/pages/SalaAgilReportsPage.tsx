import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SalaAgilRelatorios } from "@/components/sala-agil/reports/SalaAgilRelatorios";
import { AgileHistory } from "@/components/AgileHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Library } from "lucide-react";
import { fetchActiveMemberIds, filterActiveDevelopers } from "@/lib/teamMemberFilter";

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
  const [view, setView] = useState("operational");
  const [data, setData] = useState({
    sprints: [] as any[],
    hus: [] as any[],
    activities: [] as any[],
    impediments: [] as any[],
    developers: [] as any[],
    developerRecords: [] as any[],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const teamsToLoad = isAdmin && !currentTeamId
        ? agileTeams
        : agileTeams.filter((t: any) => t.id === currentTeamId);
      if (teamsToLoad.length === 0) {
        setData({ sprints: [], hus: [], activities: [], impediments: [], developers: [], developerRecords: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      const allSprints: any[] = [];
      const allHUs: any[] = [];
      const allActs: any[] = [];
      const allImps: any[] = [];
      const allDevs: any[] = [];
      const allDeveloperRecords: any[] = [];
      for (const team of teamsToLoad) {
        const [sR, hR, aR, iR, dR] = await Promise.all([
          supabase.from("sprints").select("*").eq("team_id", team.id),
          supabase.from("user_stories").select("*").eq("team_id", team.id),
          supabase.from("activities").select("*").eq("team_id", team.id),
          supabase.from("impediments").select("*").eq("team_id", team.id),
          supabase.from("developers").select("*").eq("team_id", team.id),
        ]);
        const memberIds = await fetchActiveMemberIds(team.id);
        const devsFiltered = filterActiveDevelopers((dR.data || []) as any[], memberIds);
        allDeveloperRecords.push(...(dR.data || []));
        allSprints.push(...(sR.data || []));
        allHUs.push(...(hR.data || []));
        allActs.push(...(aR.data || []));
        allImps.push(...(iR.data || []));
        allDevs.push(...devsFiltered);
      }
      if (cancelled) return;
      setData({
        sprints: allSprints, hus: allHUs, activities: allActs,
        impediments: allImps, developers: allDevs,
        developerRecords: allDeveloperRecords,
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [currentTeamId, agileTeams, isAdmin]);

  if (loading && view === "catalog") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success" />
      </div>
    );
  }

  return (
    <Tabs value={view} onValueChange={setView} className="space-y-4">
      <TabsList className="grid h-9 w-full max-w-md grid-cols-2">
        <TabsTrigger value="operational" className="gap-1.5 text-xs">
          <BarChart3 className="h-3.5 w-3.5" /> Operacional
        </TabsTrigger>
        <TabsTrigger value="catalog" className="gap-1.5 text-xs">
          <Library className="h-3.5 w-3.5" /> Catálogo de relatórios
        </TabsTrigger>
      </TabsList>
      <TabsContent value="operational" className="mt-0">
        <AgileHistory />
      </TabsContent>
      <TabsContent value="catalog" className="mt-0">
        <SalaAgilRelatorios
          sprints={data.sprints.map((s: any) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
          developers={data.developers.map((d: any) => ({
            id: d.id, name: d.name, role: d.role || "developer", user_id: d.user_id, email: d.email,
          })) as any}
          rawData={data}
          teamName={currentTeam?.name ?? "Todos os times"}
          currentUserName={(user as any)?.user_metadata?.name ?? (user as any)?.email ?? "Usuário"}
        />
      </TabsContent>
    </Tabs>
  );
}
