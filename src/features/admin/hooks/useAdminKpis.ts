import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SprintStatusType } from "@/utils/sprintStatus";
import { resolveContractTeamIds, compareTeamNames } from "../lib/resolveContractTeamIds";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TeamKpis {
  teamId:   string;
  teamName: string;
  module:   string;
  sprintAtivo:           string | null;
  sprintEndDate:         string | null;
  sprintStatus:          SprintStatusType | null;
  sprintDelayDays:       number;
  totalHUs:              number;
  husConcluidasNoSprint: number;
  velocityPontos:        number;
  impedimentosAbertos:   number;
  backlogTotal:          number;
  demandasAbertas:       number;
  demandasConcluidas:    number;
  demandasBloqueadas:    number;
  slaEmRisco:            number;
}

export interface AdminKpis {
  global: {
    totalTimes:             number;
    timesSalaAgil:          number;
    timesSustentacao:       number;
    totalHUs:               number;
    husConcluidasAtivas:    number;
    impedimentosAbertos:    number;
    backlogTotal:           number;
    velocityPontos:         number;
    demandasAbertas:        number;
    demandasConcluidas:     number;
    demandasBloqueadas:     number;
    slaEmRisco:             number;
    timesComSprintAtrasada: number;
  };
  byTeam:       TeamKpis[];
  loading:      boolean;
  error:        string | null;
  dataWarnings: string[];
}

interface RpcTeamRow {
  teamId:                string;
  sprintAtivo:           string | null;
  sprintEndDate:         string | null;
  sprintStatus:          SprintStatusType | null;
  sprintDelayDays:       number;
  totalHUs:              number;
  husConcluidasNoSprint: number;
  velocityPontos:        number;
  backlogTotal:          number;
  impedimentosAbertos:   number;
  demandasAbertas:       number;
  demandasConcluidas:    number;
  demandasBloqueadas:    number;
  slaEmRisco:            number;
}

/**
 * contractId: quando fornecido, restringe os KPIs aos times que possuem
 * pelo menos um projeto vinculado a esse contrato.
 * null = todos os times (sem filtro).
 */
export function useAdminKpis(contractId?: string | null): AdminKpis {
  const { teams: allTeams } = useAuth();
  const [filteredTeamIds, setFilteredTeamIds] = useState<string[] | null>(null);
  const [byTeam,  setByTeam]  = useState<TeamKpis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Resolve quais team_ids pertencem ao contrato selecionado
  useEffect(() => {
    if (!contractId) { setFilteredTeamIds(null); return; }
    resolveContractTeamIds(contractId).then((ids) => setFilteredTeamIds(ids ?? []));
  }, [contractId]);

  // teams efetivos: todos ou filtrados pelo contrato
  const teams = useMemo(() => {
    if (!contractId || filteredTeamIds === null) return allTeams;
    return allTeams.filter(t => filteredTeamIds.includes(t.id));
  }, [allTeams, contractId, filteredTeamIds]);

  useEffect(() => {
    // Enquanto o filtro ainda não resolveu (contractId definido mas filteredTeamIds null), aguarda
    if (contractId && filteredTeamIds === null) return;

    cancelledRef.current = false;

    async function load() {
      if (teams.length === 0) {
        setByTeam([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const teamIds = teams.map(t => t.id);

        const { data, error: rpcErr } = await supabase
          .rpc("get_admin_kpis", { p_team_ids: teamIds, p_sla_dias: 5 });

        if (rpcErr) throw rpcErr;
        if (cancelledRef.current) return;

        const rows = (data ?? []) as unknown as RpcTeamRow[];
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

        const enriched: TeamKpis[] = rows.map(row => ({
          ...row,
          teamName: teamMap[row.teamId]?.name  ?? row.teamId,
          module:   teamMap[row.teamId]?.module ?? "",
          sprintDelayDays:       row.sprintDelayDays       ?? 0,
          totalHUs:              Number(row.totalHUs)              ?? 0,
          husConcluidasNoSprint: Number(row.husConcluidasNoSprint) ?? 0,
          velocityPontos:        Number(row.velocityPontos)        ?? 0,
          backlogTotal:          Number(row.backlogTotal)          ?? 0,
          impedimentosAbertos:   Number(row.impedimentosAbertos)   ?? 0,
          demandasAbertas:       Number(row.demandasAbertas)       ?? 0,
          demandasConcluidas:    Number(row.demandasConcluidas)    ?? 0,
          demandasBloqueadas:    Number(row.demandasBloqueadas)    ?? 0,
          slaEmRisco:            Number(row.slaEmRisco)            ?? 0,
        }));

        enriched.sort((a, b) => compareTeamNames(a.teamName, b.teamName));
        setByTeam(enriched);
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          console.error("[useAdminKpis] Erro na RPC:", err);
          setError(((err as Error)?.message) ?? "Erro ao carregar KPIs");
        }
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    load();
    return () => { cancelledRef.current = true; };
  }, [teams, contractId, filteredTeamIds]);

  const global = useMemo(() => {
    const sum = (fn: (t: TeamKpis) => number) =>
      byTeam.reduce((acc, t) => acc + fn(t), 0);

    return {
      totalTimes:             teams.length,
      timesSalaAgil:          teams.filter(t => t.module === "sala_agil").length,
      timesSustentacao:       teams.filter(t => t.module === "sustentacao").length,
      totalHUs:               sum(t => t.totalHUs),
      husConcluidasAtivas:    sum(t => t.husConcluidasNoSprint),
      impedimentosAbertos:    sum(t => t.impedimentosAbertos),
      backlogTotal:           sum(t => t.backlogTotal),
      velocityPontos:         sum(t => t.velocityPontos),
      demandasAbertas:        sum(t => t.demandasAbertas),
      demandasConcluidas:     sum(t => t.demandasConcluidas),
      demandasBloqueadas:     sum(t => t.demandasBloqueadas),
      slaEmRisco:             sum(t => t.slaEmRisco),
      timesComSprintAtrasada: byTeam.filter(t => t.sprintStatus === "ativa_atrasada").length,
    };
  }, [byTeam, teams]);

  return { global, byTeam, loading, error, dataWarnings: [] };
}
