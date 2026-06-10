// ─── Tipos do módulo OKR ─────────────────────────────────────────────────

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
  cycle:       string;   // ex: "Q2/2026" — representa 3 Sprints + 1 Release
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

// ─── Ciclos — cada Q = 1 trimestre = 3 Sprints + 1 Release ────────────────────
//
//  Q1/2026 ─ Janeiro, Fevereiro, Março    →  Sprint 1 + Sprint 2 + Sprint 3 → Release 1
//  Q2/2026 ─ Abril, Maio, Junho           →  Sprint 4 + Sprint 5 + Sprint 6 → Release 2  ← CICLO ATUAL
//  Q3/2026 ─ Julho, Agosto, Setembro      →  Sprint 7 + Sprint 8 + Sprint 9 → Release 3
//  Q4/2026 ─ Outubro, Novembro, Dezembro  →  Sprint 10 + Sprint 11 + Sprint 12 → Release 4
//
//  Ritual por Sprint:
//    └─ Fim de cada Sprint: Retrospectiva + Check-in OKR (atualiza KRs com valor atual + nota da retro)
//    └─ Fim do trimestre (3ª Sprint): Fecha a Release → marca objetivo como Concluído → abre próximo ciclo

export const MOCK_CYCLES = ["Q1/2026", "Q2/2026", "Q3/2026", "Q4/2026"];

// ─── Dados mockados (usados enquanto Supabase não está integrado) ───────────────
export const MOCK_OBJECTIVES: OkrObjective[] = [

  // ─── Q1/2026 — Release 1 (encerrado) ───────────────────────────────────────────
  {
    id: "q1-1",
    title: "Fundação técnica e processos da Release 1",
    description:
      "Ciclo Q1/2026 — Release 1 (Janeiro – Março).\n" +
      "3 Sprints concluídas. Foco em estabelecer a base técnica do time: " +
      "pipeline CI/CD, padrão de qualidade e rastreabilidade das entregas.\n" +
      "Check-ins realizados ao fim de cada Sprint, integrados à Retrospectiva.",
    owner_id:   "u1",
    owner_name: "Roberto Sales",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q1/2026",
    status:     "completed",
    progress:   100,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-03-31T00:00:00Z",
    key_results: [
      {
        id: "q1-kr1", objective_id: "q1-1",
        title: "36 HUs entregues e aceitas nas 3 Sprints (12 por Sprint)",
        unit: "un", target: 36, current: 36,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-03-31T00:00:00Z",
        check_ins: [
          { id: "ci1", key_result_id: "q1-kr1", value: 12, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 1 concluída: 12 HUs aceitas. Retro apontou necessidade de refinamento mais longo.", created_at: "2026-01-31T00:00:00Z" },
          { id: "ci2", key_result_id: "q1-kr1", value: 24, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 2 concluída: mais 12 HUs. Retro: time está mais alinhado no DoD.", created_at: "2026-02-28T00:00:00Z" },
          { id: "ci3", key_result_id: "q1-kr1", value: 36, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 3 concluída: meta atingida. Release 1 entregue sem rollback.", created_at: "2026-03-31T00:00:00Z" },
        ],
      },
      {
        id: "q1-kr2", objective_id: "q1-1",
        title: "Pipeline CI/CD ativo ao fim da Release 1",
        unit: "bool", target: 1, current: 1,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-03-31T00:00:00Z",
        check_ins: [
          { id: "ci4", key_result_id: "q1-kr2", value: 0, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 1: CI/CD ainda em configuração.", created_at: "2026-01-31T00:00:00Z" },
          { id: "ci5", key_result_id: "q1-kr2", value: 0, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 2: ambiente de homologação validado, falta produção.", created_at: "2026-02-28T00:00:00Z" },
          { id: "ci6", key_result_id: "q1-kr2", value: 1, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 3: CI/CD ativo em produção. Meta concluída.", created_at: "2026-03-31T00:00:00Z" },
        ],
      },
      {
        id: "q1-kr3", objective_id: "q1-1",
        title: "Taxa de retrabalho ≤ 10% ao fim da Release 1",
        unit: "%", target: 10, current: 8,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-03-31T00:00:00Z",
        check_ins: [
          { id: "ci7", key_result_id: "q1-kr3", value: 22, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 1: retrabalho em 22% — retro identificou critérios de aceite mal definidos.", created_at: "2026-01-31T00:00:00Z" },
          { id: "ci8", key_result_id: "q1-kr3", value: 14, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 2: caiu para 14% após ajuste nos critérios de aceite.", created_at: "2026-02-28T00:00:00Z" },
          { id: "ci9", key_result_id: "q1-kr3", value: 8,  author_id: "u1", author_name: "Roberto Sales", note: "Sprint 3: 8% — abaixo da meta de 10%. Release 1 encerrada com qualidade.", created_at: "2026-03-31T00:00:00Z" },
        ],
      },
    ],
  },

  // ─── Q2/2026 — Release 2 (em andamento — ciclo atual) ───────────────────────────
  {
    id: "q2-1",
    title: "Consolidar qualidade e rastreabilidade na Release 2",
    description:
      "Ciclo Q2/2026 — Release 2 (Abril – Junho). EM ANDAMENTO.\n" +
      "Sprint 4 concluída com retro realizada. Sprint 5 em execução.\n" +
      "Check-in feito ao fim de cada Sprint, integrado à Retrospectiva do time.\n" +
      "Meta: manter ou superar os índices conquistados na Release 1.",
    owner_id:   "u1",
    owner_name: "Roberto Sales",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q2/2026",
    status:     "on_track",
    progress:   66,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    key_results: [
      {
        id: "kr1", objective_id: "q2-1",
        title: "36 HUs entregues e aceitas nas 3 Sprints (12 por Sprint)",
        unit: "un", target: 36, current: 24,
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
        check_ins: [
          { id: "ci10", key_result_id: "kr1", value: 12, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 4 concluída: 12 HUs aceitas. Retro: fluxo de refinamento funcionando bem.", created_at: "2026-04-30T00:00:00Z" },
          { id: "ci11", key_result_id: "kr1", value: 24, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 5 concluída: mais 12 HUs. Retro: 1 impedimento de infraestrutura resolvido.", created_at: "2026-05-31T00:00:00Z" },
        ],
      },
      {
        id: "kr2", objective_id: "q2-1",
        title: "Taxa de retrabalho ≤ 8% ao fim da Release 2",
        unit: "%", target: 8, current: 10,
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
        check_ins: [
          { id: "ci12", key_result_id: "kr2", value: 11, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 4: retrabalho em 11% — retro identificou falta de testes de aceite antes do PR.", created_at: "2026-04-30T00:00:00Z" },
          { id: "ci13", key_result_id: "kr2", value: 10, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 5: leve melhora para 10%. Sprint 6 precisa fechar abaixo de 8%.", created_at: "2026-05-31T00:00:00Z" },
        ],
      },
      {
        id: "kr3", objective_id: "q2-1",
        title: "Zero bugs críticos em produção ao fim da Release 2",
        unit: "bugs", target: 0, current: 1,
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
        check_ins: [
          { id: "ci14", key_result_id: "kr3", value: 2, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 4: 2 bugs críticos abertos. Retro priorizou correção na Sprint 5.", created_at: "2026-04-30T00:00:00Z" },
          { id: "ci15", key_result_id: "kr3", value: 1, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 5: 1 bug resolvido. 1 ainda aberto — Sprint 6 é prazo final.", created_at: "2026-05-31T00:00:00Z" },
        ],
      },
      {
        id: "kr4", objective_id: "q2-1",
        title: "100% das Retrospectivas com plano de ação registrado no sistema",
        unit: "%", target: 100, current: 67,
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
        check_ins: [
          { id: "ci16", key_result_id: "kr4", value: 33, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 4: retro registrada com 3 ações. 1 de 3 sprints concluída.", created_at: "2026-04-30T00:00:00Z" },
          { id: "ci17", key_result_id: "kr4", value: 67, author_id: "u1", author_name: "Roberto Sales", note: "Sprint 5: retro registrada com 4 ações. 2 de 3 sprints concluídas.", created_at: "2026-05-31T00:00:00Z" },
        ],
      },
    ],
  },

  // ─── Q3/2026 — Release 3 (planejamento) ───────────────────────────────────────
  {
    id: "q3-1",
    title: "Evoluir a plataforma e reduzir débito técnico na Release 3",
    description:
      "Ciclo Q3/2026 — Release 3 (Julho – Setembro). EM PLANEJAMENTO.\n" +
      "Ciclo ainda não iniciado. Objetivos e KRs serão refinados ao fechar a Release 2.\n" +
      "Foco esperado: redução de débito técnico acumulado e evolução de features estratégicas.\n" +
      "Check-ins serão realizados ao fim das Sprints 7, 8 e 9 integrados às Retrospectivas.",
    owner_id:   "u1",
    owner_name: "Roberto Sales",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q3/2026",
    status:     "on_track",
    progress:   0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    key_results: [
      {
        id: "q3-kr1", objective_id: "q3-1",
        title: "36 HUs entregues e aceitas nas 3 Sprints (12 por Sprint)",
        unit: "un", target: 36, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q3-kr2", objective_id: "q3-1",
        title: "Taxa de retrabalho ≤ 5% ao fim da Release 3",
        unit: "%", target: 5, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q3-kr3", objective_id: "q3-1",
        title: "Zero bugs críticos em produção ao fim da Release 3",
        unit: "bugs", target: 0, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q3-kr4", objective_id: "q3-1",
        title: "100% das Retrospectivas com plano de ação registrado",
        unit: "%", target: 100, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
    ],
  },

  // ─── Q4/2026 — Release 4 (planejamento futuro) ────────────────────────────────
  {
    id: "q4-1",
    title: "Fechar o ano com excelência operacional na Release 4",
    description:
      "Ciclo Q4/2026 — Release 4 (Outubro – Dezembro). PLANEJAMENTO FUTURO.\n" +
      "Ciclo ainda não iniciado. Objetivos serão definidos ao encerrar a Release 3.\n" +
      "Foco esperado: consolidação anual, fechamento de entregas estratégicas e " +
      "planejamento do roadmap 2027.\n" +
      "Check-ins nas Sprints 10, 11 e 12 integrados às Retrospectivas do time.",
    owner_id:   "u1",
    owner_name: "Roberto Sales",
    team_id:    "t1",
    team_name:  "NEXO - TIME A",
    cycle:      "Q4/2026",
    status:     "on_track",
    progress:   0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    key_results: [
      {
        id: "q4-kr1", objective_id: "q4-1",
        title: "36 HUs entregues e aceitas nas 3 Sprints (12 por Sprint)",
        unit: "un", target: 36, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q4-kr2", objective_id: "q4-1",
        title: "Taxa de retrabalho ≤ 5% ao fim da Release 4",
        unit: "%", target: 5, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q4-kr3", objective_id: "q4-1",
        title: "Zero bugs críticos em produção ao fim da Release 4",
        unit: "bugs", target: 0, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "q4-kr4", objective_id: "q4-1",
        title: "Roadmap 2027 documentado e aprovado pelo time",
        unit: "bool", target: 1, current: 0,
        created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
      },
    ],
  },
];
