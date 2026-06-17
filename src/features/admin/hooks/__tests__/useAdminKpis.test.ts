import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminKpis } from "../useAdminKpis";

// Use vi.hoisted to ensure mocks are available when vi.mock is called
const { mockRpc, mockAuthData } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockAuthData: {
    teams: [
      { id: "team-a", name: "Time Alpha", module: "sala_agil" },
      { id: "team-b", name: "Time Beta",  module: "sustentacao" }
    ]
  }
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthData,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn()
  },
}));

vi.mock("../lib/resolveContractTeamIds", () => ({
  resolveContractTeamIds: vi.fn().mockResolvedValue(["team-a", "team-b"]),
  compareTeamNames: (a: string, b: string) => a.localeCompare(b),
}));

const MOCK_TEAM_ROWS = [
  {
    teamId: "team-a",
    totalHUs: 2,
    husConcluidasNoSprint: 1,
    velocityPontos: 5,
    backlogTotal: 1,
    impedimentosAbertos: 1,
    slaEmRisco: 1,
    demandasAbertas: 1,
    demandasConcluidas: 1,
    demandasBloqueadas: 0,
    sprintAtivo: "Sprint 1",
    sprintEndDate: "2026-06-20",
    sprintStatus: "ativa_no_prazo",
    sprintDelayDays: 0
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: MOCK_TEAM_ROWS, error: null });
});

describe("useAdminKpis", () => {
  it("inicia em estado de loading e depois carrega", async () => {
    const { result } = renderHook(() => useAdminKpis());
    // Use a simple wait for loading to change
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(result.current.byTeam).toBeDefined();
  });
});
