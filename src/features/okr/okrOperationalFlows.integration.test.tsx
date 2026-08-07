import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOkrAlertsV2 } from "./hooks/useOkrAlertsV2";
import { useOkrInitiativesV2 } from "./hooks/useOkrInitiativesV2";
import { useOkrObjectiveReviews } from "./hooks/useOkrReviewsV2";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("OKR operational flows integration", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockImplementation(async (name: string) => {
      if (name.startsWith("list_")) return { data: [], error: null };
      if (name === "run_okr_alert_engine_v1") return { data: 2, error: null };
      return { data: `${name}-result`, error: null };
    });
  });

  it("submits, approves and carries an objective forward with tenant scope", async () => {
    const { result } = renderHook(() => useOkrObjectiveReviews("cycle-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submit.mutateAsync({
        objectiveId: "objective-1",
        payload: {
          final_score: 90,
          outcome_summary: "Resultado entregue",
          carry_forward_decision: "full_objective",
          carry_forward_reason: "Continuidade estratégica",
        },
      });
      await result.current.decide.mutateAsync({
        reviewId: "review-1",
        approve: true,
      });
      await result.current.carryForward.mutateAsync({
        objectiveId: "objective-1",
        targetCycleId: "cycle-2",
        type: "full_objective",
        reason: "Continuidade estratégica",
      });
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "submit_okr_objective_review_v1",
      expect.objectContaining({
        p_org_id: "org-1",
        p_objective_id: "objective-1",
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "approve_okr_objective_review_v1",
      expect.objectContaining({
        p_org_id: "org-1",
        p_review_id: "review-1",
        p_approve: true,
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "carry_forward_okr_objective_v1",
      expect.objectContaining({
        p_org_id: "org-1",
        p_target_cycle_id: "cycle-2",
        p_carry_forward_type: "full_objective",
      }),
    );
  });

  it("creates, updates, links and archives initiatives through RPCs", async () => {
    const { result } = renderHook(
      () => useOkrInitiativesV2("objective-1"),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.create.mutateAsync({
        title: "Mitigar risco",
        status: "planned",
        priority: "high",
        progress: 0,
      });
      await result.current.update.mutateAsync({
        id: "initiative-1",
        payload: {
          status: "blocked",
          blocked_reason: "Dependência externa",
        },
      });
      await result.current.addDependency.mutateAsync({
        initiativeId: "initiative-1",
        dependsOnId: "initiative-2",
        type: "blocks",
      });
      await result.current.archive.mutateAsync({
        id: "initiative-1",
        reason: "Encerrada no ciclo",
      });
    });

    for (const name of [
      "create_okr_initiative_v1",
      "update_okr_initiative_v1",
      "add_okr_initiative_dependency_v1",
      "archive_okr_initiative_v1",
    ]) {
      expect(rpcMock).toHaveBeenCalledWith(
        name,
        expect.objectContaining({ p_org_id: "org-1" }),
      );
    }
  });

  it("runs, acknowledges and resolves alerts with tenant scope", async () => {
    const { result } = renderHook(() => useOkrAlertsV2("open"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.runEngine.mutateAsync();
      await result.current.acknowledge.mutateAsync({
        id: "alert-1",
        note: "Em tratamento",
      });
      await result.current.resolve.mutateAsync({
        id: "alert-1",
        note: "Risco mitigado",
      });
    });

    expect(rpcMock).toHaveBeenCalledWith("run_okr_alert_engine_v1", {
      p_org_id: "org-1",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "acknowledge_okr_alert_v1",
      expect.objectContaining({
        p_org_id: "org-1",
        p_alert_id: "alert-1",
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "resolve_okr_alert_v1",
      expect.objectContaining({
        p_org_id: "org-1",
        p_alert_id: "alert-1",
      }),
    );
  });

  it("propagates backend authorization failures without optimistic success", async () => {
    rpcMock.mockImplementation(async (name: string) => {
      if (name.startsWith("list_")) return { data: [], error: null };
      return {
        data: null,
        error: { message: "OKR_V2_ACCESS_DENIED", code: "42501" },
      };
    });

    const { result } = renderHook(() => useOkrAlertsV2("open"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.resolve.mutateAsync({ id: "alert-1" }),
    ).rejects.toMatchObject({ message: "OKR_V2_ACCESS_DENIED" });
  });
});
