import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAdminKpis } from "../useAdminKpis";

const waitFor = async (assertion: () => void) => {
  for (let i = 0; i < 20; i++) {
    try { assertion(); return; } catch (error) {
      if (i === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
};

// ── Mocks ─────────────────────────────────────────────────────────────────
const TEAM_A = { id: "team-a", name: "Time Alpha", module: "sala_agil" };
const TEAM_B = { id: "team-b", name: "Time Beta",  module: "sustentacao" };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ teams: [TEAM_A, TEAM_B] }),
}));

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

/** Helper: cria um mock de query chain que resolve com data */
function makeQuery(data: unknown[]) {
  const chain: any = {
    select: () => chain,
    range:  () => Promise.resolve({ data, error: null }),
  };
  return chain;
}

// ── Dados de fixture ──────────────────────────────────────────────────────

const TODAY     = new Date().toISOString();
const OLD_DATE  = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 dias atrás
const FUTURE    = new Date(Date.now() + 7  * 24 * 60 * 60 * 1000).toISOString();

const SPRINT_A_ACTIVE = { id: "sp-a", name: "Sprint 1", end_date: FUTURE, is_active: true,  team_id: "team-a", closed_at: null, delay_days: null };
const SPRINT_B_OLD    = { id: "sp-b", name: "Sprint 2", end_date: OLD_DATE, is_active: true, team_id: "team-b", closed_at: null, delay_days: null };

const HUS = [
  { id: "hu-1", status: "Concluída",    story_points: 5,  sprint_id: "sp-a", team_id: "team-a" },
  { id: "hu-2", status: "Em Andamento", story_points: 3,  sprint_id: "sp-a", team_id: "team-a" },
  { id: "hu-3", status: "A Fazer",      story_points: 2,  sprint_id: null,   team_id: "team-a" }, // backlog
  { id: "hu-4", status: "Concluída",    story_points: 8,  sprint_id: "sp-b", team_id: "team-b" },
];

const IMPEDIMENTS = [
  { id: "imp-1", resolved_at: null,  team_id: "team-a" }, // aberto
  { id: "imp-2", resolved_at: TODAY, team_id: "team-a" }, // resolvido
];

const DEMANDAS = [
  { id: "dem-1", situacao: "Aberta",    created_at: OLD_DATE, team_id: "team-a" }, // SLA em risco
  { id: "dem-2", situacao: "Concluída", created_at: TODAY,    team_id: "team-a" },
];

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === "user_stories")  return makeQuery(HUS);
    if (table === "sprints")       return makeQuery([SPRINT_A_ACTIVE, SPRINT_B_OLD]);
    if (table === "impediments")   return makeQuery(IMPEDIMENTS);
    if (table === "demandas")      return makeQuery(DEMANDAS);
    return makeQuery([]);
  });
});

// ── Testes ─────────────────────────────────────────────────────────────────

describe("useAdminKpis", () => {
  it("inicia em estado de loading", () => {
    const { result } = renderHook(() => useAdminKpis());
    expect(result.current.loading).toBe(true);
  });

  it("finaliza o carregamento após fetch", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("retorna KPIs globais corretos para 2 times", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const g = result.current.global;
    expect(g.totalTimes).toBe(2);
    expect(g.timesSalaAgil).toBe(1);
    expect(g.timesSustentacao).toBe(1);
  });

  it("contabiliza corretamente HUs concluídas no sprint ativo do team-a", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const teamA = result.current.byTeam.find(t => t.teamId === "team-a");
    expect(teamA?.husConcluidasNoSprint).toBe(1); // apenas hu-1
    expect(teamA?.velocityPontos).toBe(5);        // story_points de hu-1
    expect(teamA?.totalHUs).toBe(2);              // hu-1 e hu-2 no sprint ativo
  });

  it("contabiliza backlog (HUs sem sprint_id)", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const teamA = result.current.byTeam.find(t => t.teamId === "team-a");
    expect(teamA?.backlogTotal).toBe(1); // hu-3 sem sprint_id
  });

  it("conta apenas impedimentos não resolvidos", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const teamA = result.current.byTeam.find(t => t.teamId === "team-a");
    expect(teamA?.impedimentosAbertos).toBe(1); // imp-1 não resolvido
  });

  it("identifica demandas com SLA em risco (criadas há mais de 5 dias)", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const teamA = result.current.byTeam.find(t => t.teamId === "team-a");
    expect(teamA?.slaEmRisco).toBe(1); // dem-1 com created_at = OLD_DATE
  });

  it("detecta sprint atrasada em team-b (end_date no passado)", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.global.timesComSprintAtrasada).toBeGreaterThanOrEqual(1);
  });

  it("retorna dataWarnings vazio quando não há truncamento", async () => {
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dataWarnings).toHaveLength(0);
  });

  it("não falha quando supabase retorna arrays vazios", async () => {
    mockFrom.mockImplementation(() => makeQuery([]));
    const { result } = renderHook(() => useAdminKpis());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.global.totalHUs).toBe(0);
    expect(result.current.global.impedimentosAbertos).toBe(0);
  });
});
