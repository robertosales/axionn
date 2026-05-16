import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SprintStatusType } from "@/utils/sprintStatus";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TeamKpis {
  teamId:   string;
  teamName: string;
  module:   string;
  sprintAtivo:           string | null;
  sprintEndDate:         string | null;
  /** Status semântico da sprint ativa: ativa | ativa_atrasada | encerrada | encerrada_sem_registro */
  sprintStatus:          SprintStatusType | null;
  /** Dias de atraso da sprint */
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
  /** Mantido por compatibilidade — vazio quando RPC está em uso */
  dataWarnings: string[];
}

// ─── Raw shape retornado pela RPC ─────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminKpis(): AdminKpis {
  const { teams } = useAuth();
  const [byTeam,  setByTeam]  = useState<TeamKpis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
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

        const rows = (data ?? []) as RpcTeamRow[];

        // Enriquece com nome e módulo do time (vêm do AuthContext, não da RPC)
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

        setByTeam(enriched);
      } catch (err: any) {
        if (!cancelledRef.current) {
          console.error("[useAdminKpis] Erro na RPC:", err);
          setError(err?.message ?? "Erro ao carregar KPIs");
        }
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    load();
    return () => { cancelledRef.current = true; };
  }, [teams]);

  // ── Totais globais ────────────────────────────────────────────────────────
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
