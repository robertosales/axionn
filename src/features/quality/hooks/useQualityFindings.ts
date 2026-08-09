import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQualityFinding, type CreateFindingInput, listQualityFindings, updateQualityFindingStatus } from "../services/qualityFindings.service";

export const findingKeys = { list: (org: string) => ["quality", org, "findings"] as const };

export function useQualityFindings(org: string | null) {
  return useQuery({ queryKey: findingKeys.list(org ?? ""), queryFn: () => listQualityFindings(org!), enabled: Boolean(org) });
}

export function useFindingActions(org: string) {
  const client = useQueryClient();
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: findingKeys.list(org) }), client.invalidateQueries({ queryKey: ["quality", org, "overview"] })]);
  return {
    create: useMutation({ mutationFn: (input: CreateFindingInput) => createQualityFinding(org, input), onSuccess: refresh }),
    status: useMutation({ mutationFn: (input: { id: string; status: string }) => updateQualityFindingStatus(org, input.id, input.status), onSuccess: refresh }),
  };
}
