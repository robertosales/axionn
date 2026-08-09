import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addPlanItem,
  createRunFromPlan,
  createTestPlan,
  type CreateQualityRunInput,
  listTestPlans,
  removePlanItem,
} from "../services/qualityTestPlans.service";

export function useTestPlans(org: string | null) {
  return useQuery({
    queryKey: ["quality", org, "plans"],
    queryFn: () => listTestPlans(org!),
    enabled: Boolean(org),
  });
}

export function usePlanActions(org: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["quality", org, "plans"] });

  return {
    create: useMutation({
      mutationFn: (payload: Record<string, unknown>) => createTestPlan(org, payload),
      onSuccess: refresh,
    }),
    add: useMutation({
      mutationFn: (payload: { planId: string; caseId: string; version: number }) =>
        addPlanItem(org, payload.planId, payload.caseId, payload.version),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (payload: { planId: string; caseId: string }) =>
        removePlanItem(org, payload.planId, payload.caseId),
      onSuccess: refresh,
    }),
    run: useMutation({
      mutationFn: (payload: CreateQualityRunInput & { planId: string }) =>
        createRunFromPlan(org, payload.planId, payload),
      onSuccess: refresh,
    }),
  };
}
