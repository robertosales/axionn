import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export type CapacityStatus = "ok" | "warning" | "overloaded" | "idle" | "unknown";

export interface DevCapacity {
  devId:            string;
  devName:          string;
  teamId:           string;
  teamName:         string;
  capacityHours:    number;
  allocatedHours:   number;
  realizedHours:    number;
  wipCount:         number;
  utilizationPct:   number;
  realizationPct:   number;
  status:           CapacityStatus;
  unestimatedCount: number;
  noActiveSprint:   boolean;
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
  realizationPct: number;
  devs:           DevCapacity[];
  hasUnestimated: boolean;
}

// ── Raw shapes da RPC ──────────────────────────────────────────────────

interface RpcDevRow {
  devId:            string;
  devName:          string;
  teamId:           string;
  capacityHours:    number;
  allocatedHours:   number;
  realizedHours:    number;
  wipCount:         number;
  husCount:         number;
  unestimatedCount: number;
  noActiveSprint:   boolean;
}

interface RpcTeamRow {
  teamId:         string;
  sprintAtivo:    string | null;
  sprintEndDate:  string | null;
  totalCapacity:  number;
  totalAllocated: number;
  totalRealized:  number;
  devs:           RpcDevRow[];
}

// ── Helper: status do dev ────────────────────────────────────────────────

function calcStatus(
  husCount: number,
  unestimatedCount: number,
  utilPct: number
): CapacityStatus {
  if (husCount > 0 && unestimatedCount === husCount) return "unknown";
  if (utilPct >= 100) return "overloaded";
  if (utilPct >= 80)  return "warning";
  if (utilPct > 0)    return "ok";
  return "idle";
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCapacityPlanner() {
  const { teams } = useAuth();
  const [teamCapacities,   setTeamCapacities]   = useState<TeamCapacity[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [selectedTeam,     setSelectedTeam]     = useState("all");
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    cancelledRef.current = false;

    if (teams.length === 0) {
      setTeamCapacities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const teamIds = teams.map(t => t.id);
      const teamId  = selectedTeam !== "all" ? selectedTeam : null;

      const { data, error: rpcErr } = await supabase.rpc("get_capacity_planner", {
        p_team_ids:    teamIds,
        p_team_id:     teamId,
        p_default_cap: 40,
      });

      if (rpcErr) throw rpcErr;
      if (cancelledRef.current) return;

      const rows    = (data ?? []) as RpcTeamRow[];
      const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

      const enriched: TeamCapacity[] = rows.map(row => {
        const teamInfo  = teamMap[row.teamId];
        const totalCap  = Number(row.totalCapacity);
        const totalAlloc= Number(row.totalAllocated);
        const totalReal = Number(row.totalRealized);

        const devs: DevCapacity[] = (row.devs ?? []).map(d => {
          const cap      = Number(d.capacityHours);
          const alloc    = Number(d.allocatedHours);
          const realized = Number(d.realizedHours);
          const utilPct  = cap > 0 ? Math.round((alloc    / cap) * 100) : 0;
          const realPct  = cap > 0 ? Math.round((realized / cap) * 100) : 0;

          return {
            devId:            d.devId,
            devName:          d.devName,
            teamId:           row.teamId,
            teamName:         teamInfo?.name ?? row.teamId,
            capacityHours:    cap,
            allocatedHours:   alloc,
            realizedHours:    realized,
            wipCount:         Number(d.wipCount),
            utilizationPct:   utilPct,
            realizationPct:   realPct,
            status:           calcStatus(Number(d.husCount), Number(d.unestimatedCount), utilPct),
            unestimatedCount: Number(d.unestimatedCount),
            noActiveSprint:   d.noActiveSprint,
          };
        }).sort((a, b) => b.utilizationPct - a.utilizationPct);

        return {
          teamId:         row.teamId,
          teamName:       teamInfo?.name   ?? row.teamId,
          module:         teamInfo?.module ?? "",
          sprintAtivo:    row.sprintAtivo,
          sprintEndDate:  row.sprintEndDate,
          totalCapacity:  totalCap,
          totalAllocated: totalAlloc,
          totalRealized:  totalReal,
          utilizationPct: totalCap > 0 ? Math.round((totalAlloc / totalCap) * 100) : 0,
          realizationPct: totalCap > 0 ? Math.round((totalReal  / totalCap) * 100) : 0,
          devs,
          hasUnestimated: devs.some(d => d.unestimatedCount > 0),
        };
      });

      setTeamCapacities(enriched);
    } catch (err: any) {
      if (!cancelledRef.current) {
        console.error("[useCapacityPlanner] Erro na RPC:", err);
        setError(err?.message ?? "Erro ao carregar capacidade");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [teams, selectedTeam]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  // ── Derivados ────────────────────────────────────────────────────────────

  const overloadedDevs = useMemo(
    () => teamCapacities.flatMap(t => t.devs).filter(d => d.status === "overloaded"),
    [teamCapacities]
  );

  const unknownStatusDevs = useMemo(
    () => teamCapacities.flatMap(t => t.devs).filter(d => d.status === "unknown"),
    [teamCapacities]
  );

  return {
    teamCapacities,
    overloadedDevs,
    unknownStatusDevs,
    loading,
    error,
    selectedTeam,
    setSelectedTeam,
    reload: load,
  };
}
