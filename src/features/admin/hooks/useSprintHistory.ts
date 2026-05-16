import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export interface DevStat {
  developerId:    string;
  developerName:  string;
  husCount:       number;
  estimatedHours: number;
  realizedHours:  number;
}

export interface SprintMetrics {
  sprintId:        string;
  sprintName:      string;
  teamId:          string;
  teamName:        string;
  startDate:       string;
  endDate:         string;
  goal:            string | null;
  durationDays:    number;
  totalHUs:        number;
  husConcluidadas: number;
  taxaConclusao:   number;
  velocityPontos:  number;
  horasPlanejadas: number;
  horasRealizadas: number;
  desvioHoras:     number;
  impedimentos:    number;
  devStats:        DevStat[];
  durationWarning?: boolean;
}

export type PeriodoFiltro = "3m" | "6m" | "12m" | "all";

export interface SprintHistoryFilters {
  teamId:  string;
  periodo: PeriodoFiltro;
}

export interface TeamComparativo {
  teamId:            string;
  teamName:          string;
  module:            string;
  avgVelocity:       number;
  avgTaxaConclusao:  number;
  avgDesvioHoras:    number;
  totalSprints:      number;
  totalImpedimentos: number;
  semDados:          boolean;
}

// ── Helper: cutoff por período ────────────────────────────────────────────

function cutoffDateStr(periodo: PeriodoFiltro): string | null {
  if (periodo === "all") return null;
  const d = new Date();
  const months = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ── Raw shapes da RPC ───────────────────────────────────────────────────

interface RpcMetricRow {
  sprintId:        string;
  sprintName:      string;
  teamId:          string;
  startDate:       string;
  endDate:         string;
  goal:            string | null;
  durationDays:    number;
  totalHUs:        number;
  husConcluidadas: number;
  taxaConclusao:   number;
  velocityPontos:  number;
  horasPlanejadas: number;
  horasRealizadas: number;
  desvioHoras:     number;
  impedimentos:    number;
  devStats:        DevStat[];
}

interface RpcComparativoRow {
  teamId:            string;
  totalSprints:      number;
  avgVelocity:       number;
  avgTaxaConclusao:  number;
  avgDesvioHoras:    number;
  totalImpedimentos: number;
  semDados:          boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSprintHistory() {
  const { teams } = useAuth();
  const [metrics,          setMetrics]          = useState<SprintMetrics[]>([]);
  const [teamComparativo,  setTeamComparativo]  = useState<TeamComparativo[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [filters,          setFilters]          = useState<SprintHistoryFilters>({ teamId: "all", periodo: "6m" });
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    cancelledRef.current = false;

    if (teams.length === 0) {
      setMetrics([]);
      setTeamComparativo([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const teamIds  = teams.map(t => t.id);
      const teamId   = filters.teamId !== "all" ? filters.teamId : null;
      const cutoff   = cutoffDateStr(filters.periodo);

      const { data, error: rpcErr } = await supabase.rpc("get_sprint_history", {
        p_team_ids: teamIds,
        p_team_id:  teamId,
        p_cutoff:   cutoff,
      });

      if (rpcErr) throw rpcErr;
      if (cancelledRef.current) return;

      const result   = data as { metrics: RpcMetricRow[]; comparativo: RpcComparativoRow[] };
      const teamMap  = Object.fromEntries(teams.map(t => [t.id, t]));

      // Enriquece métricas com teamName (vem do AuthContext)
      const enrichedMetrics: SprintMetrics[] = (result.metrics ?? []).map(row => ({
        ...row,
        teamName:        teamMap[row.teamId]?.name ?? row.teamId,
        totalHUs:        Number(row.totalHUs),
        husConcluidadas: Number(row.husConcluidadas),
        taxaConclusao:   Number(row.taxaConclusao),
        velocityPontos:  Number(row.velocityPontos),
        horasPlanejadas: Number(row.horasPlanejadas),
        horasRealizadas: Number(row.horasRealizadas),
        desvioHoras:     Number(row.desvioHoras),
        impedimentos:    Number(row.impedimentos),
        durationWarning: Number(row.durationDays) < 0,
        devStats:        (row.devStats ?? []).map(d => ({
          ...d,
          husCount:       Number(d.husCount),
          estimatedHours: Number(d.estimatedHours),
          realizedHours:  Number(d.realizedHours),
        })),
      }));

      // Enriquece comparativo com teamName e module
      const enrichedComp: TeamComparativo[] = (result.comparativo ?? []).map(row => ({
        ...row,
        teamName:         teamMap[row.teamId]?.name   ?? row.teamId,
        module:           teamMap[row.teamId]?.module ?? "",
        totalSprints:     Number(row.totalSprints),
        avgVelocity:      Number(row.avgVelocity),
        avgTaxaConclusao: Number(row.avgTaxaConclusao),
        avgDesvioHoras:   Number(row.avgDesvioHoras),
        totalImpedimentos:Number(row.totalImpedimentos),
      }));

      // Times sem dados no período (presentes no AuthContext mas ausentes na RPC)
      const rpcTeamIds = new Set(enrichedComp.map(r => r.teamId));
      teams.forEach(t => {
        if (!rpcTeamIds.has(t.id)) {
          enrichedComp.push({
            teamId: t.id, teamName: t.name, module: t.module,
            avgVelocity: 0, avgTaxaConclusao: 0, avgDesvioHoras: 0,
            totalSprints: 0, totalImpedimentos: 0, semDados: true,
          });
        }
      });

      setMetrics(enrichedMetrics);
      setTeamComparativo(
        filters.teamId === "all"
          ? enrichedComp
          : enrichedComp.filter(t => t.teamId === filters.teamId)
      );
    } catch (err: any) {
      if (!cancelledRef.current) {
        console.error("[useSprintHistory] Erro na RPC:", err);
        setError(err?.message ?? "Erro ao carregar histórico");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [teams, filters]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  // setFilterTeam e setFilterPeriodo mantidos por compatibilidade com testes
  const setFilterTeam   = useCallback((teamId: string) =>
    setFilters(f => ({ ...f, teamId })), []);
  const setFilterPeriod = useCallback((periodo: PeriodoFiltro) =>
    setFilters(f => ({ ...f, periodo })), []);

  return {
    metrics,
    teamComparativo,
    loading,
    error,
    filters,
    setFilters,
    setFilterTeam,
    setFilterPeriod,
    reload: load,
  };
}
