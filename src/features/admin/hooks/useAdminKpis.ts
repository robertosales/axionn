import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSprintStatus, SprintStatusType } from "@/utils/sprintStatus";
import { STATUS_CONCLUIDOS, STATUS_BLOQUEADOS, isConcluido, isBloqueado } from "@/shared/constants/statusConstants";

const SLA_DIAS = 5;
const PAGE_SIZE = 1000;

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
  /** Status semantico da sprint ativa: ativa | ativa_atrasada | encerrada | encerrada_sem_registro */
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
  /** Indica se os dados podem estar incompletos (hard limit atingido) */
  dataWarning?: string;
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
  /** Avisos de dados possivelmente incompletos por paginacao */
  dataWarnings: string[];
}

/** Busca todas as paginas de uma tabela com paginacao automatica */
async function fetchAllPages<T>(
  table: string,
  selectFields: string,
  extraFilters?: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<{ data: T[]; truncated: boolean }> {
  const MAX_PAGES = 20; // protecao contra loop infinito
  let allData: T[] = [];
  let from = 0;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    let query = supabase.from(table).select(selectFields).range(from, from + PAGE_SIZE - 1);
    if (extraFilters) query = extraFilters(query as any) as any;

    const { data, error } = await (query as any);

    if (error) {
      console.error(`[useAdminKpis] Erro ao buscar ${table}:`, error);
      return { data: allData, truncated: false };
    }

    const page = (data ?? []) as T[];
    allData = [...allData, ...page];

    if (page.length < PAGE_SIZE) break; // ultima pagina
    from += PAGE_SIZE;
    pageCount++;
  }

  const truncated = pageCount >= MAX_PAGES;
  if (truncated) {
    console.warn(`[useAdminKpis] Limite de paginas atingido para tabela: ${table}. Dados podem estar incompletos.`);
  }

  return { data: allData, truncated };
}

export function useAdminKpis(): AdminKpis {
  const { teams } = useAuth();
  const [hus,         setHus]         = useState<RawHU[]>([]);
  const [sprints,     setSprints]     = useState<RawSprint[]>([]);
  const [impediments, setImpediments] = useState<RawImpediment[]>([]);
  const [demandas,    setDemandas]    = useState<RawDemanda[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function load() {
      setLoading(true);
      const warnings: string[] = [];

      try {
        const [
          { data: huData,   truncated: huTrunc },
          { data: spData,   truncated: spTrunc },
          { data: impData,  truncated: impTrunc },
          { data: demData,  truncated: demTrunc },
        ] = await Promise.all([
          fetchAllPages<RawHU>("user_stories",  "id, status, story_points, sprint_id, team_id"),
          fetchAllPages<RawSprint>("sprints",   "id, name, end_date, is_active, team_id, closed_at, delay_days"),
          fetchAllPages<RawImpediment>("impediments", "id, resolved_at, team_id"),
          fetchAllPages<RawDemanda>("demandas",  "id, situacao, created_at, team_id"),
        ]);

        if (cancelledRef.current) return;

        if (huTrunc)  warnings.push("User Stories: volume muito alto, dados podem estar incompletos.");
        if (spTrunc)  warnings.push("Sprints: volume muito alto, dados podem estar incompletos.");
        if (impTrunc) warnings.push("Impedimentos: volume muito alto, dados podem estar incompletos.");
        if (demTrunc) warnings.push("Demandas: volume muito alto, dados podem estar incompletos.");

        setHus(huData);
        setSprints(spData);
        setImpediments(impData);
        setDemandas(demData);
        setDataWarnings(warnings);
      } catch (err) {
        console.error("[useAdminKpis] Erro inesperado no carregamento:", err);
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    load();
    return () => { cancelledRef.current = true; };
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
      const husConcluidas = husNoSprint.filter(h => isConcluido(h.status));
      const velocityPts   = husConcluidas.reduce((s, h) => s + (h.story_points ?? 0), 0);
      const backlog       = teamHUs.filter(h => !h.sprint_id).length;
      const impedAbertos  = teamImpediments.filter(i => !i.resolved_at).length;

      const sprintStatusResult = activeSprint ? getSprintStatus(activeSprint) : null;

      const dAbertas  = teamDemandas.filter(d => !isConcluido(d.situacao)).length;
      const dConclui  = teamDemandas.filter(d =>  isConcluido(d.situacao)).length;
      const dBloq     = teamDemandas.filter(d =>  isBloqueado(d.situacao)).length;
      const dSlaRisco = teamDemandas.filter(d => {
        return !isConcluido(d.situacao) && new Date(d.created_at) <= limiteRisco;
      }).length;

      return {
        teamId: team.id, teamName: team.name, module: team.module,
        sprintAtivo:           activeSprint?.name ?? null,
        sprintEndDate:         activeSprint?.end_date ?? null,
        sprintStatus:          sprintStatusResult?.status ?? null,
        sprintDelayDays:       sprintStatusResult?.delayDays ?? 0,
        totalHUs:              husNoSprint.length,
        husConcluidasNoSprint: husConcluidas.length,
        velocityPontos:        velocityPts,
        impedimentosAbertos:   impedAbertos,
        backlogTotal:          backlog,
        demandasAbertas:       dAbertas,
        demandasConcluidas:    dConclui,
        demandasBloqueadas:    dBloq,
        slaEmRisco:            dSlaRisco,
      };
    });
  }, [teams, hus, sprints, impediments, demandas]);

  const global = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    return {
      totalTimes:             teams.length,
      timesSalaAgil:          teams.filter(t => t.module === "sala_agil").length,
      timesSustentacao:       teams.filter(t => t.module === "sustentacao").length,
      totalHUs:               sum(byTeam.map(t => t.totalHUs)),
      husConcluidasAtivas:    sum(byTeam.map(t => t.husConcluidasNoSprint)),
      impedimentosAbertos:    sum(byTeam.map(t => t.impedimentosAbertos)),
      backlogTotal:           sum(byTeam.map(t => t.backlogTotal)),
      velocityPontos:         sum(byTeam.map(t => t.velocityPontos)),
      demandasAbertas:        sum(byTeam.map(t => t.demandasAbertas)),
      demandasConcluidas:     sum(byTeam.map(t => t.demandasConcluidas)),
      demandasBloqueadas:     sum(byTeam.map(t => t.demandasBloqueadas)),
      slaEmRisco:             sum(byTeam.map(t => t.slaEmRisco)),
      timesComSprintAtrasada: byTeam.filter(t => t.sprintStatus === "ativa_atrasada").length,
    };
  }, [byTeam, teams]);

  return { global, byTeam, loading, dataWarnings };
}
