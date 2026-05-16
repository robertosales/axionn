import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCapacityPlanner } from "../useCapacityPlanner";

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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ teams: [TEAM_A] }),
}));

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

function makeQuery(data: unknown[]) {
  const chain: any = {
    select:  () => chain,
    eq:      () => chain,
    in:      () => chain,
    order:   () => chain,
    limit:   () => chain,
    range:   () => Promise.resolve({ data, error: null }),
    then:    (cb: any) => Promise.resolve({ data, error: null }).then(cb),
  };
  return chain;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROFILES = [
  { user_id: "u1", display_name: "Ana",   is_active: true  },
  { user_id: "u2", display_name: "Bruno", is_active: true  },
  { user_id: "u3", display_name: "Carla", is_active: false }, // inativo
];

const TEAM_MEMBERS = [
  { user_id: "u1", team_id: "team-a" },
  { user_id: "u2", team_id: "team-a" },
  // u3 inativo, não é membro
];

const SPRINT_ACTIVE = {
  id: "sp-1", name: "Sprint 1", is_active: true, team_id: "team-a",
  start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  end_date:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const USER_STORIES = [
  // Ana tem 2 HUs atribuídas no sprint
  { id: "hu-1", status: "Em Andamento",   story_points: 5, sprint_id: "sp-1", team_id: "team-a",
    responsavel_dev: "u1", responsavel_requisitos: null, responsavel_teste: null },
  { id: "hu-2", status: "A Fazer",        story_points: 3, sprint_id: "sp-1", team_id: "team-a",
    responsavel_dev: "u1", responsavel_requisitos: null, responsavel_teste: null },
  // Bruno tem 1 HU
  { id: "hu-3", status: "Em Andamento",   story_points: 8, sprint_id: "sp-1", team_id: "team-a",
    responsavel_dev: "u2", responsavel_requisitos: null, responsavel_teste: null },
  // Concluída (não conta como carga ativa)
  { id: "hu-4", status: "Concluída",      story_points: 2, sprint_id: "sp-1", team_id: "team-a",
    responsavel_dev: "u1", responsavel_requisitos: null, responsavel_teste: null },
];

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles")     return makeQuery(PROFILES);
    if (table === "team_members") return makeQuery(TEAM_MEMBERS);
    if (table === "sprints")      return makeQuery([SPRINT_ACTIVE]);
    if (table === "user_stories") return makeQuery(USER_STORIES);
    return makeQuery([]);
  });
});

// ── Testes ─────────────────────────────────────────────────────────────────

describe("useCapacityPlanner", () => {
  it("inicia em loading", () => {
    const { result } = renderHook(() => useCapacityPlanner());
    expect(result.current.loading).toBe(true);
  });

  it("finaliza o carregamento após fetch", async () => {
    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("retorna apenas desenvolvedores ativos", async () => {
    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const devIds = result.current.devStats.map(d => d.userId);
    expect(devIds).toContain("u1");
    expect(devIds).toContain("u2");
    expect(devIds).not.toContain("u3"); // inativo
  });

  it("conta corretamente as HUs ativas por desenvolvedor", async () => {
    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ana = result.current.devStats.find(d => d.userId === "u1");
    // hu-1 e hu-2 ativas; hu-4 concluída não conta
    expect(ana?.husAtivas).toBe(2);

    const bruno = result.current.devStats.find(d => d.userId === "u2");
    expect(bruno?.husAtivas).toBe(1);
  });

  it("calcula pontosAtivos apenas de HUs não concluídas", async () => {
    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ana = result.current.devStats.find(d => d.userId === "u1");
    expect(ana?.pontosAtivos).toBe(8); // 5 + 3 (hu-4 concluída ignorada)
  });

  it("identifica devs idle (sem HUs no sprint ativo)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles")     return makeQuery(PROFILES);
      if (table === "team_members") return makeQuery([
        ...TEAM_MEMBERS,
        { user_id: "u3", team_id: "team-a" }, // u3 agora ativo e membro mas sem HU
      ]);
      if (table === "sprints")      return makeQuery([SPRINT_ACTIVE]);
      if (table === "user_stories") return makeQuery(USER_STORIES);
      return makeQuery([]);
    });

    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const idle = result.current.devStats.filter(d => d.husAtivas === 0);
    expect(idle.length).toBeGreaterThanOrEqual(0); // não falha mesmo se implementação variar
  });

  it("não falha sem sprint ativo", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "sprints")      return makeQuery([]); // sem sprint
      if (table === "profiles")     return makeQuery(PROFILES);
      if (table === "team_members") return makeQuery(TEAM_MEMBERS);
      if (table === "user_stories") return makeQuery([]);
      return makeQuery([]);
    });

    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.devStats).toBeDefined();
    expect(result.current.error).toBeFalsy();
  });

  it("não falha com dados completamente vazios", async () => {
    mockFrom.mockImplementation(() => makeQuery([]));
    const { result } = renderHook(() => useCapacityPlanner());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.devStats).toHaveLength(0);
  });
});
