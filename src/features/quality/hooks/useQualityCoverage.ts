import { useQuery } from "@tanstack/react-query";
import { listQualityCoverage } from "../services/qualityCoverage.service";

export function useQualityCoverage(orgId: string | null) {
  return useQuery({ queryKey: ["quality", orgId, "coverage"], queryFn: () => listQualityCoverage(orgId!), enabled: Boolean(orgId), staleTime: 30_000 });
}
