import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSprintStatus, SprintStatusType } from "@/utils/sprintStatus";

const CONCLUIDOS = ["concluido", "resolvido", "aceite_final", "ag_aceite_final"];
const BLOQUEADOS  = ["bloqueada", "bloqueado"];
const SLA_DIAS   = 5;

interface RawHU        { id: string; status: string; story_points: number | null; sprint_id: string | null; team_id: string; }
interface RawSprint    { id: string; name: string; end_date: string | null; is_active: boolean; team_id: string; closed_at: string | null; delay_days: number | null; }
interface RawImpediment{ id: string; resolved_at: string | null; team_id: string; }
interface RawDemanda   { id: string; situacao: string | null; created_at: string; team_id: string; }

export interface TeamKpis {
  teamId:   string;
  teamName: string;
  module:   string;
  sprintAtivo:           string | null;
  sprintEndDate:         string | null;
  /** Status semântico da sprint ativa: ativa | ativa_atrasada | encerrada | encerrada_sem_registro */
  sprintStatus:          SprintStatusType | null;
  /** Dias de atraso: > 0 se ativa_atrasada, ou o delay_days registrado se encerrada */
  sprintDelayDays:       number;
  totalHUs:              number;
  husConcluidasNoSprint: number;
  velocityPontos:        number;
  impedimentosAbertos:   number;
  backlogTotal:          number;
  demandasAbertas:    number;
  demandasConcluidas: number;
  demandasBloqueadas: number;
  slaEmRisco:         number;
}

export interface AdminKpis {
  global: {
    totalTimes:            number;
    timesSalaAgil:         number;
    timesSustentacao:      number;
    totalHUs:              number;
    husConcluidasAtivas:   number;
    impedimentosAbertos:   number;
    backlogTotal:          number;
    velocityPontos:        number;
    demandasAbertas:       number;
    demandasConcluidas:    number;
    demandasBloqueadas:    number;
    slaEmRisco:            number;
    /** Times com sprint ativa atrasada */
    timesComSprintAtrasada: number;
  };
  byTeam: TeamKpis[];
  loading: boolean;
}

export function useAdminKpis(): AdminKpis {
  const { teams } = useAuth();
  const [hus,         setHus]         = useState<RawHU[]>([]);
  const [sprints,     setSprints]     = useState<RawSprint[]>([]);
  const [impediments, setImpediments] = useState<RawImpediment[]>([]);
  const [demandas,    setDemandas]    = useState<RawDemanda[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [huRes, spRes, impRes, demRes] = await Promise.all([
          supabase.from("user_stories").select("id, status, story_points, sprint_id, team_id").limit(2000),
          supabase.from("sprints").select("id, name, end_date, is_active, team_id, closed_at, delay_days").limit(200),
          supabase.from("impediments").select("id, resolved_at, team_id").limit(1000),
          supabase.from("demandas").select("id, situacao, created_at, team_id").limit(2000),
        ]);
        if (cancelled) return;
        setHus(         (huRes.data  || []) as RawHU[]);
        setSprints(     (spRes.data  || []) as RawSprint[]);
        setImpediments( (impRes.data || []) as RawImpediment[]);
        setDemandas(    (demRes.data || []) as RawDemanda[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const byTeam: TeamKpis[] = useMemo(() => {
    const hoje        = new Date();
    const limiteRisco = new Date(hoje);
    limiteRisco.setDate(hoje.getDate() - SLA_DIAS);

    return teams.map(team => {
      const teamHUs         = hus.filter(h => h.team_id === team.id);
      const teamSprints     = sprints.filter(s => s.team_id === team.id);
      const teamImpediments = impediments.filter(i => i.team_id === team.id);
      const teamDemandas    = demandas.filter(d => d.team_id === team.id);

      const activeSprint  = teamSprints.find(s => s.is_active) ?? null;
      const husNoSprint   = activeSprint ? teamHUs.filter(h => h.sprint_id === activeSprint.id) : [];
      const husConcluidas = husNoSprint.filter(h => CONCLUIDOS.includes(h.status));
      const velocityPts   = husConcluidas.reduce((s, h) => s + (h.story_points ?? 0), 0);
      const backlog       = teamHUs.filter(h => !h.sprint_id).length;
      const impedAbertos  = teamImpediments.filter(i => !i.resolved_at).length;

      // Status semântico da sprint ativa
      const sprintStatusResult = activeSprint
        ? getSprintStatus(activeSprint)
        : null;

      const dAbertas  = teamDemandas.filter(d => !CONCLUIDOS.includes(d.situacao?.toLowerCase() ?? "")).length;
      const dConclui  = teamDemandas.filter(d =>  CONCLUIDOS.includes(d.situacao?.toLowerCase() ?? "")).length;
      const dBloq     = teamDemandas.filter(d =>  BLOQUEADOS.includes(d.situacao?.toLowerCase()  ?? "")).length;
      const dSlaRisco = teamDemandas.filter(d => {
        const aberto = !CONCLUIDOS.includes(d.situacao?.toLowerCase() ?? "");
        return aberto && new Date(d.created_at) <= limiteRisco;
      }).length;

      return {
        teamId: team.id, teamName: team.name, module: team.module,
        sprintAtivo:      activeSprint?.name ?? null,
        sprintEndDate:    activeSprint?.end_date ?? null,
        sprintStatus:     sprintStatusResult?.status ?? null,
        sprintDelayDays:  sprintStatusResult?.delayDays ?? 0,
        totalHUs: husNoSprint.length,
        husConcluidasNoSprint: husConcluidas.length,
        velocityPontos: velocityPts,
        impedimentosAbertos: impedAbertos,
        backlogTotal: backlog,
        demandasAbertas: dAbertas,
        demandasConcluidas: dConclui,
        demandasBloqueadas: dBloq,
        slaEmRisco: dSlaRisco,
      };
    });
  }, [teams, hus, sprints, impediments, demandas]);

  const global = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    return {
      totalTimes:           teams.length,
      timesSalaAgil:        teams.filter(t => t.module === "sala_agil").length,
      timesSustentacao:     teams.filter(t => t.module === "sustentacao").length,
      totalHUs:             sum(byTeam.map(t => t.totalHUs)),
      husConcluidasAtivas:  sum(byTeam.map(t => t.husConcluidasNoSprint)),
      impedimentosAbertos:  sum(byTeam.map(t => t.impedimentosAbertos)),
      backlogTotal:         sum(byTeam.map(t => t.backlogTotal)),
      velocityPontos:       sum(byTeam.map(t => t.velocityPontos)),
      demandasAbertas:      sum(byTeam.map(t => t.demandasAbertas)),
      demandasConcluidas:   sum(byTeam.map(t => t.demandasConcluidas)),
      demandasBloqueadas:   sum(byTeam.map(t => t.demandasBloqueadas)),
      slaEmRisco:           sum(byTeam.map(t => t.slaEmRisco)),
      timesComSprintAtrasada: byTeam.filter(t => t.sprintStatus === "ativa_atrasada").length,
    };
  }, [byTeam, teams]);

  return { global, byTeam, loading };
}
