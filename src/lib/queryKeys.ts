/**
 * Query keys centralizadas e tipadas.
 *
 * Padrão: ['entidade', 'operação', ...params]
 * Permite invalidação granular:
 *   queryClient.invalidateQueries({ queryKey: KEYS.demandas.all(teamId) })
 *   → invalida todas as queries de demandas daquele time
 */

export const KEYS = {
  // ── Demandas ───────────────────────────────────────────────────────────
  demandas: {
    all:    (teamId: string) => ['demandas', teamId]             as const,
    list:   (teamId: string) => ['demandas', teamId, 'list']     as const,
    detail: (id: string)     => ['demandas', 'detail', id]       as const,
    transitions: (id: string)=> ['demandas', 'transitions', id]  as const,
    hours:  (id: string)     => ['demandas', 'hours', id]        as const,
    allTransitions: (teamId: string) => ['demandas', teamId, 'all-transitions'] as const,
    allHours: (teamId: string) => ['demandas', teamId, 'all-hours'] as const,
    // Fase 4: chave separada para não colidir com o cache de list (eager)
    infinite: (teamId: string) => ['demandas', teamId, 'infinite'] as const,
  },

  // ── KPIs ──────────────────────────────────────────────────────────────────
  kpis: {
    all:         (teamId: string) => ['kpis', teamId]                              as const,
    sustentacao: (teamId: string, backlogDias: number) =>
                   ['kpis', teamId, 'sustentacao', backlogDias]                    as const,
  },

  // ── Responsáveis ───────────────────────────────────────────────────────────
  responsaveis: {
    // Cache do fetch batch por IDs de demanda (P1-fix)
    byDemandas: (teamId: string, idsHash: string) =>
                  ['responsaveis', teamId, 'by-demandas', idsHash]                 as const,
    // F3-B: cache de responsáveis enriquecidos por time (RPC enriquecimento)
    byTeam:     (teamId: string) =>
                  ['responsaveis', teamId, 'by-team']                              as const,
  },

  // ── Kanban / User Stories ────────────────────────────────────────────────
  kanban: {
    all:    (teamId: string) => ['kanban', teamId]               as const,
    board:  (teamId: string, sprintId?: string | null) =>
              ['kanban', teamId, 'board', sprintId ?? 'all']     as const,
    // F3-A: chave separada para infinite query de cards (sprintFilter=all)
    // Não colide com KEYS.kanban.board que é usado por sprint específico/ativo
    infinite: (teamId: string) => ['kanban', teamId, 'infinite'] as const,
  },

  // ── Sprints ───────────────────────────────────────────────────────────────────
  sprints: {
    all:    (teamId: string) => ['sprints', teamId]              as const,
    active: (teamId: string) => ['sprints', teamId, 'active']    as const,
  },

  // ── Referência ─────────────────────────────────────────────────────────────────
  projetos:   (teamId: string) => ['projetos', teamId]           as const,
  fases:      (teamId: string) => ['fases', teamId]              as const,
  workflow:   (teamId: string) => ['workflow', teamId]           as const,

  // ── Admin / KPIs ─────────────────────────────────────────────────────────────
  adminKpis:  (teamIds: string[]) => ['admin', 'kpis', ...teamIds] as const,

  // ── Perfil / Auth ────────────────────────────────────────────────────────────
  profile:    (userId: string) => ['profile', userId]            as const,
  profiles: {
    active:   ()               => ['profiles', 'active']         as const,
  },
  teams:      ()               => ['teams']                      as const,
} as const;
