import { useQuery } from "@tanstack/react-query";
import { getApfDossierCreationOptions, listApfEvidenceDossiers } from "../services/apfEvidenceDossier.service";

export function useApfEvidenceDossiers(organizationId: string | null) {
  return useQuery({
    queryKey: ["apf-evidence-dossiers", organizationId],
    queryFn: () => listApfEvidenceDossiers(organizationId!),
    enabled: Boolean(organizationId),
  });
}

export function useApfDossierCreationOptions(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["apf-dossier-creation-options", organizationId],
    queryFn: () => getApfDossierCreationOptions(organizationId!),
    enabled: Boolean(organizationId) && enabled,
  });
}
