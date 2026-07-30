import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type {
  OkrCarryForwardType,
  OkrCycleReview,
  OkrCycleReviewInput,
  OkrObjectiveReview,
  OkrObjectiveReviewInput,
} from "../types/review";

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrObjectiveReviews(cycleId: string | null) {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrObjectiveReview[]>({
    queryKey: ["okr_objective_reviews_v2", currentOrganizationId ?? "none", cycleId ?? "all"],
    enabled: !!currentOrganizationId,
    staleTime: 20_000,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const rows = await callRpc<OkrObjectiveReview[]>("list_okr_objective_reviews_v1", {
        p_org_id: currentOrganizationId,
        p_cycle_id: cycleId,
      });
      return rows ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["okr_objective_reviews_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_objectives_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_cycle_review_v2"] });
  };

  const submit = useMutation({
    mutationFn: async ({ objectiveId, payload }: { objectiveId: string; payload: OkrObjectiveReviewInput }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("submit_okr_objective_review_v1", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
        p_payload: payload,
      });
    },
    onSuccess: invalidate,
  });

  const decide = useMutation({
    mutationFn: async ({ reviewId, approve, reason }: { reviewId: string; approve: boolean; reason?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("approve_okr_objective_review_v1", {
        p_org_id: currentOrganizationId,
        p_review_id: reviewId,
        p_approve: approve,
        p_reason: reason ?? null,
      });
    },
    onSuccess: invalidate,
  });

  const carryForward = useMutation({
    mutationFn: async (input: {
      objectiveId: string;
      targetCycleId: string;
      type: OkrCarryForwardType;
      reason: string;
      keyResultIds?: string[] | null;
    }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("carry_forward_okr_objective_v1", {
        p_org_id: currentOrganizationId,
        p_objective_id: input.objectiveId,
        p_target_cycle_id: input.targetCycleId,
        p_carry_forward_type: input.type,
        p_reason: input.reason,
        p_key_result_ids: input.keyResultIds ?? null,
      });
    },
    onSuccess: invalidate,
  });

  const byObjective = (objectiveId: string) =>
    (list.data ?? []).find((r) => r.objective_id === objectiveId) ?? null;

  return {
    reviews: list.data ?? [],
    isLoading: list.isLoading,
    byObjective,
    submit,
    decide,
    carryForward,
  };
}

export function useOkrCycleReview(cycleId: string | null) {
  const qc = useQueryClient();

  const review = useQuery<OkrCycleReview | null>({
    queryKey: ["okr_cycle_review_v2", cycleId ?? "none"],
    enabled: !!cycleId,
    staleTime: 20_000,
    queryFn: async () => {
      if (!cycleId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("okr_cycle_reviews")
        .select("*")
        .eq("cycle_id", cycleId)
        .maybeSingle();
      if (error) throw error;
      return (data as OkrCycleReview) ?? null;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["okr_cycle_review_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_cycles"] });
  };

  const generate = useMutation({
    mutationFn: async (payload: OkrCycleReviewInput) => {
      if (!cycleId) throw new Error("Ciclo não selecionado.");
      return callRpc<string>("upsert_okr_cycle_review_v1", {
        p_cycle_id: cycleId,
        p_payload: payload,
      });
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (closeCycle: boolean) => {
      if (!cycleId) throw new Error("Ciclo não selecionado.");
      return callRpc("approve_okr_cycle_review_v1", {
        p_cycle_id: cycleId,
        p_close_cycle: closeCycle,
      });
    },
    onSuccess: invalidate,
  });

  return { review: review.data ?? null, isLoading: review.isLoading, generate, approve };
}
