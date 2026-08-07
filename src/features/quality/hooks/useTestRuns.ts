import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addEvidence, completeRun, getTestRun, listTestRuns, reopenRun, startRun, updateStep } from "../services/qualityTestRuns.service";

export const runKeys = {
  list: (org: string) => ["quality", org, "runs"] as const,
  detail: (org: string, id: string) => ["quality", org, "run", id] as const,
};

export function useTestRuns(org: string | null) {
  return useQuery({ queryKey: runKeys.list(org ?? ""), queryFn: () => listTestRuns(org!), enabled: Boolean(org) });
}

export function useTestRun(org: string | null, id: string | undefined) {
  return useQuery({ queryKey: runKeys.detail(org ?? "", id ?? ""), queryFn: () => getTestRun(org!, id!), enabled: Boolean(org && id) });
}

export function useRunActions(org: string, id: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: runKeys.detail(org, id) }),
      client.invalidateQueries({ queryKey: runKeys.list(org) }),
      client.invalidateQueries({ queryKey: ["quality", org, "overview"] }),
    ]);
  };
  return {
    start: useMutation({ mutationFn: () => startRun(org, id), onSuccess: refresh }),
    step: useMutation({ mutationFn: (payload: { id: string; status: string; actual: string }) => updateStep(org, payload.id, payload.status, payload.actual), onSuccess: refresh }),
    evidence: useMutation({ mutationFn: (payload: { itemId: string; stepId: string; title: string; url: string }) => addEvidence(org, payload.itemId, payload.stepId, payload.title, payload.url), onSuccess: refresh }),
    complete: useMutation({ mutationFn: (allow: boolean) => completeRun(org, id, allow), onSuccess: refresh }),
    reopen: useMutation({ mutationFn: (reason: string) => reopenRun(org, id, reason), onSuccess: refresh }),
  };
}
