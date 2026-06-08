import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Tipos públicos ──────────────────────────────────────────────────────────

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
  pausedCount:      number;
  slaCriticalCount: number;
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

// ── Raw shapes da RPC ────────────────────────────────────────────────────

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
  pausedCount?:     number;
  slaCriticalCount?: number;
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

// ── Helper: status do dev ───────────────────────────────────────────────────

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

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCapacityPlanner() {
  const { teams } = useAuth();
  const [teamCapacities,   setTeamCapacities]   = useState<TeamCapacity[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [selectedTeam,     setSelectedTeam]     = useState("all");
  const cancelledRef = useRef(false);

  /**
   * fix(capacidade-dedup): `useAuth().teams` contém uma entrada por
   * (time × módulo) desde o fix teams-dedup-v2 no AuthContext.
   * Isso causava times duplicados no <Select> e IDs repetidos enviados
   * à RPC, resultando em integrantes e capacidades incorretos.
   *
   * `uniqueTeams` garante exatamente uma entrada por `team.id`,
   * preservando o primeiro módulo encontrado para cada time.
   */
  const uniqueTeams = useMemo(() => {
    const seen = new Set<string>();
    return teams.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [teams]);

  /**
   * `teamMap` indexado por id único — usado no enrichment para recuperar
   * nome e módulo do time retornado pela RPC.
   * Mantém compatibilidade com a lógica anterior que usava teams.map(t => [t.id, t]).
   */
  const teamMap = useMemo(
    () => Object.fromEntries(uniqueTeams.map(t => [t.id, t])),
    [uniqueTeams]
  );

  const load = useCallback(async () => {
    cancelledRef.current = false;

    if (uniqueTeams.length === 0) {
      setTeamCapacities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Particiona times por módulo: Sala Ágil (sprints) vs Sustentação (semana corrente)
      const agilIds        = uniqueTeams.filter(t => t.module === "sala_agil").map(t => t.id);
      const sustentacaoIds = uniqueTeams.filter(t => t.module === "sustentacao").map(t => t.id);

      const teamId = selectedTeam !== "all" ? selectedTeam : undefined;

      const buildParams = (ids: string[]) => {
        const p: { p_team_ids: string[]; p_team_id?: string; p_default_cap?: number } = {
          p_team_ids:    ids,
          p_default_cap: 40,
        };
        if (teamId !== undefined) p.p_team_id = teamId;
        return p;
      };

      const [agilRes, sustRes] = await Promise.all([
        agilIds.length        ? supabase.rpc("get_capacity_planner",              buildParams(agilIds))        : Promise.resolve({ data: [], error: null } as any),
        sustentacaoIds.length ? supabase.rpc("get_capacity_planner_sustentacao", buildParams(sustentacaoIds)) : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (agilRes.error) throw agilRes.error;
      if (sustRes.error) throw sustRes.error;
      if (cancelledRef.current) return;

      const rows = ([
        ...((agilRes.data ?? []) as any[]),
        ...((sustRes.data ?? []) as any[]),
      ]) as unknown as RpcTeamRow[];

      const enriched: TeamCapacity[] = rows.map(row => {
        const teamInfo   = teamMap[row.teamId];
        const totalCap   = Number(row.totalCapacity);
        const totalAlloc = Number(row.totalAllocated);
        const totalReal  = Number(row.totalRealized);

        const devs: DevCapacity[] = (row.devs ?? []).map(d => {
          const cap      = Number(d.capacityHours);
          const alloc    = Number(d.allocatedHours);
          const realized = Number(d.realizedHours);
          const isSust   = teamInfo?.module === "sustentacao";
          // Utilização sempre baseada em horas alocadas (estimadas) / capacidade
          const utilPct  = cap > 0 ? Math.round((alloc / cap) * 100) : 0;
          const realPct  = cap > 0 ? Math.round((realized / cap) * 100) : 0;
          const wip      = Number(d.wipCount);
          const paused   = Number(d.pausedCount ?? 0);
          const slaCrit  = Number(d.slaCriticalCount ?? 0);

          let status: CapacityStatus;
          if (isSust) {
            // Risco de SLA tem prioridade absoluta
            if (slaCrit > 0) status = "overloaded";
            else if (wip === 0 && alloc === 0 && realized === 0) status = "idle";
            else if (alloc > cap || wip > 5) status = "overloaded";
            else if (alloc >= cap * 0.8 || wip >= 4) status = "warning";
            else status = "ok";
          } else {
            status = calcStatus(Number(d.husCount), Number(d.unestimatedCount), utilPct);
          }

          return {
            devId:            d.devId,
            devName:          d.devName,
            teamId:           row.teamId,
            teamName:         teamInfo?.name ?? row.teamId,
            capacityHours:    cap,
            allocatedHours:   alloc,
            realizedHours:    realized,
            wipCount:         wip,
            utilizationPct:   utilPct,
            realizationPct:   realPct,
            status:           status,
            unestimatedCount: Number(d.unestimatedCount),
            noActiveSprint:   d.noActiveSprint,
            pausedCount:      paused,
            slaCriticalCount: slaCrit,
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
  }, [uniqueTeams, teamMap, selectedTeam]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

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
    devStats: teamCapacities.flatMap(t => t.devs).map((d) => ({
      ...d,
      userId: d.devId,
      husAtivas: d.wipCount,
      pontosAtivos: d.allocatedHours,
    })),
    overloadedDevs,
    unknownStatusDevs,
    loading,
    error,
    selectedTeam,
    setSelectedTeam,
    reload: load,
    /** Lista de times sem duplicatas — use para popular o <Select> */
    uniqueTeams,
  };
}
