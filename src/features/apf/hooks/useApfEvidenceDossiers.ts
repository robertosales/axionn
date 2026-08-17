import { useQuery } from "@tanstack/react-query";
import { listApfEvidenceDossiers } from "../services/apfEvidenceDossier.service";

export function useApfEvidenceDossiers(organizationId: string | null) {
  return useQuery({
    queryKey: ["apf-evidence-dossiers", organizationId],
    queryFn: () => listApfEvidenceDossiers(organizationId!),
    enabled: Boolean(organizationId),
  });
}
