import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Raw types ────────────────────────────────────────────────────────────────
interface RawDev    { id: string; name: string; capacity: number | null; team_id: string; }
interface RawHU     { id: string; status: string; estimated_hours: number | null; assignee_id: string | null; sprint_id: string | null; team_id: string; }
interface RawAct    { id: string; hu_id: string; hours: number; assignee_id: string; }
interface RawSprint { id: string; name: string; is_active: boolean; team_id: string; end_date: string | null; }

// ── Public types ─────────────────────────────────────────────────────────────
export type CapacityStatus = "ok" | "warning" | "overloaded" | "idle";

export interface DevCapacity {
  devId:           string;
  devName:         string;
  teamId:          string;
  teamName:        string;
  capacityHours:   number;    // capacidade declarada (default 40h)
  allocatedHours:  number;    // soma estimated_hours das HUs no sprint ativo
  realizedHours:   number;    // soma activities.hours no sprint ativo
  wipCount:        number;    // HUs em andamento (não concluídas e não backlog)
  utilizationPct:  number;    // allocatedHours / capacityHours * 100
  status:          CapacityStatus;
}

export interface TeamCapacity {
  teamId:         string;
  teamName:       string;
  module:         string;
  sprintAtivo:    string | null;
  sprintEndDate:  string | null;
  totalCapacity:  number;
  totalAllocated: number;
  totalRealized:  number;
  utilizationPct: number;
  devs:           DevCapacity[];
}

const DEFAULT_CAPACITY = 40;
const CONCLUIDOS = ["concluido", "concluida", "done", "aceite", "aceite_final", "ag_aceite_final"];
const WIP_EXCLUIDOS = [...CONCLUIDOS, "cancelada", "backlog"];

export function useCapacityPlanner() {
  const { teams } = useAuth();
  const [devs,    setDevs]    = useState<RawDev[]>([]);
  const [hus,     setHus]     = useState<RawHU[]>([]);
  const [acts,    setActs]    = useState<RawAct[]>([]);
  const [sprints, setSprints] = useState<RawSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, huRes, actRes, spRes] = await Promise.all([
        supabase.from("developers").select("id, name, capacity, team_id").limit(500),
        supabase.from("user_stories").select("id, status, estimated_hours, assignee_id, sprint_id, team_id").limit(2000),
        supabase.from("activities").select("id, hu_id, hours, assignee_id").limit(5000),
        supabase.from("sprints").select("id, name, is_active, team_id, end_date").eq("is_active", true).limit(50),
      ]);
      setDevs(   (devRes.data  || []) as RawDev[]);
      setHus(    (huRes.data   || []) as RawHU[]);
      setActs(   (actRes.data  || []) as RawAct[]);
      setSprints((spRes.data   || []) as RawSprint[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const teamCapacities: TeamCapacity[] = useMemo(() => {
    const teamMap: Record<string, { name: string; module: string }> = {};
    teams.forEach(t => { teamMap[t.id] = { name: t.name, module: t.module }; });

    return teams
      .filter(t => selectedTeam === "all" || t.id === selectedTeam)
      .map(team => {
        const activeSprint = sprints.find(s => s.team_id === team.id) ?? null;
        const teamDevs     = devs.filter(d => d.team_id === team.id);
        const sprintHUs    = activeSprint
          ? hus.filter(h => h.sprint_id === activeSprint.id)
          : [];
        const sprintHUIds  = new Set(sprintHUs.map(h => h.id));
        const sprintActs   = acts.filter(a => sprintHUIds.has(a.hu_id));

        const devCapacities: DevCapacity[] = teamDevs.map(dev => {
          const cap        = dev.capacity ?? DEFAULT_CAPACITY;
          const devHUs     = sprintHUs.filter(h => h.assignee_id === dev.id);
          const devActs    = sprintActs.filter(a => a.assignee_id === dev.id);
          const allocated  = devHUs.reduce((s, h) => s + (h.estimated_hours ?? 0), 0);
          const realized   = devActs.reduce((s, a) => s + a.hours, 0);
          const wip        = devHUs.filter(h => !WIP_EXCLUIDOS.includes(h.status)).length;
          const utilPct    = cap > 0 ? Math.round((allocated / cap) * 100) : 0;

          const status: CapacityStatus =
            utilPct >= 100 ? "overloaded" :
            utilPct >= 80  ? "warning"    :
            utilPct > 0    ? "ok"         : "idle";

          return {
            devId:          dev.id,
            devName:        dev.name,
            teamId:         team.id,
            teamName:       team.name,
            capacityHours:  cap,
            allocatedHours: Math.round(allocated * 10) / 10,
            realizedHours:  Math.round(realized  * 10) / 10,
            wipCount:       wip,
            utilizationPct: utilPct,
            status,
          };
        });

        const totalCap  = devCapacities.reduce((s, d) => s + d.capacityHours,  0);
        const totalAlloc= devCapacities.reduce((s, d) => s + d.allocatedHours, 0);
        const totalReal = devCapacities.reduce((s, d) => s + d.realizedHours,  0);

        return {
          teamId:         team.id,
          teamName:       team.name,
          module:         team.module,
          sprintAtivo:    activeSprint?.name    ?? null,
          sprintEndDate:  activeSprint?.end_date ?? null,
          totalCapacity:  totalCap,
          totalAllocated: Math.round(totalAlloc * 10) / 10,
          totalRealized:  Math.round(totalReal  * 10) / 10,
          utilizationPct: totalCap > 0 ? Math.round((totalAlloc / totalCap) * 100) : 0,
          devs:           devCapacities.sort((a, b) => b.utilizationPct - a.utilizationPct),
        };
      });
  }, [teams, devs, hus, acts, sprints, selectedTeam]);

  // Devs sobrecarregados globais
  const overloadedDevs = useMemo(() =>
    teamCapacities.flatMap(t => t.devs).filter(d => d.status === "overloaded"),
  [teamCapacities]);

  return { teamCapacities, overloadedDevs, loading, selectedTeam, setSelectedTeam, reload: load };
}
