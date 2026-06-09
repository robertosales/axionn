// ─── Tipos do módulo OKR ─────────────────────────────────────────────────────

export type OkrStatus = "on_track" | "at_risk" | "off_track" | "completed";

export type OkrUnit = "%" | "pts" | "bugs" | "score" | "dias" | "bool" | "R$" | "un";

export interface OkrKeyResult {
  id:           string;
  objective_id: string;
  title:        string;
  unit:         OkrUnit;
  target:       number;
  current:      number;
  check_ins?:   OkrCheckIn[];
  created_at:   string;
  updated_at:   string;
}

export interface OkrCheckIn {
  id:             string;
  key_result_id:  string;
  value:          number;
  note:           string;
  author_id:      string;
  author_name?:   string;
  created_at:     string;
}

export interface OkrObjective {
  id:          string;
  title:       string;
  description?: string;
  owner_id:    string;
  owner_name?: string;
  team_id:     string;
  team_name?:  string;
  cycle:       string;   // ex: "Q2/2026"
  status:      OkrStatus;
  progress:    number;   // 0-100, calculado a partir dos KRs
  key_results: OkrKeyResult[];
  created_at:  string;
  updated_at:  string;
}

export interface OkrFilters {
  cycle: string;
  teamId: string;
}

// ─── Dados mockados (usados enquanto Supabase não está integrado) ─────────────
export const MOCK_CYCLES = ["Q1/2026", "Q2/2026", "Q3/2026", "Q4/2026"];

export const MOCK_OBJECTIVES: OkrObjective[] = [
  {
    id: "1",
    title: "Entregar software de qualidade contínua",
    description: "Garantir que todas as entregas do time mantenham padrão de qualidade alto, com rastreabilidade e baixo índice de retrabalho.",
    owner_id:   "u1",
    owner_name: "Roberto Sales",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q2/2026",
    status:     "on_track",
    progress:   74,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    key_results: [
      { id: "kr1", objective_id: "1", title: "80% das sprints sem débito técnico acumulado", unit: "%",    target: 80,  current: 65,  created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
      { id: "kr2", objective_id: "1", title: "Velocity médio ≥ 40 pontos por sprint",        unit: "pts",  target: 40,  current: 38,  created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
      { id: "kr3", objective_id: "1", title: "90% das HUs entregues dentro do prazo",        unit: "%",    target: 90,  current: 71,  created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
      { id: "kr4", objective_id: "1", title: "Zero bugs críticos em produção no trimestre",  unit: "bugs", target: 0,   current: 0,   created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
    ],
  },
  {
    id: "2",
    title: "Aumentar satisfação e engajamento do time",
    description: "Criar um ambiente de trabalho saudável onde o time se sente ouvido, engajado e reconhecido.",
    owner_id:   "u2",
    owner_name: "Ana Lima",
    team_id:    "t2",
    team_name:  "TIME B",
    cycle:      "Q2/2026",
    status:     "at_risk",
    progress:   42,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    key_results: [
      { id: "kr5", objective_id: "2", title: "NPS interno do time ≥ 8.0",                    unit: "score", target: 8,   current: 6.2, created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
      { id: "kr6", objective_id: "2", title: "100% das retros com plano de ação registrado", unit: "%",     target: 100, current: 50,  created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
      { id: "kr7", objective_id: "2", title: "Reduzir tempo médio de resolução de bug 30%",  unit: "dias",  target: 3,   current: 4.8, created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
    ],
  },
  {
    id: "3",
    title: "Entregar o módulo RDM v2 em produção",
    description: "Finalizar o desenvolvimento, homologação e deploy do módulo RDM v2 dentro do ciclo Q2.",
    owner_id:   "u3",
    owner_name: "Carlos Mendes",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q2/2026",
    status:     "completed",
    progress:   100,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
    key_results: [
      { id: "kr8",  objective_id: "3", title: "100% dos requisitos homologados pelo cliente", unit: "%",    target: 100, current: 100, created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-09T00:00:00Z" },
      { id: "kr9",  objective_id: "3", title: "Deploy em produção sem rollback",              unit: "bool", target: 1,   current: 1,   created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-09T00:00:00Z" },
      { id: "kr10", objective_id: "3", title: "Documentação técnica publicada",               unit: "%",    target: 100, current: 100, created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-09T00:00:00Z" },
    ],
  },
];
