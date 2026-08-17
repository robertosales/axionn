import { useQuery } from "@tanstack/react-query";
import { getApfDossierCreationOptions, listApfAcceptanceCriteria, listApfEvidenceDossiers, listApfEvidenceSources } from "../services/apfEvidenceDossier.service";

export function useApfEvidenceDossiers(organizationId: string | null) {
  return useQuery({
    queryKey: ["apf-evidence-dossiers", organizationId],
    queryFn: () => listApfEvidenceDossiers(organizationId!),
    enabled: Boolean(organizationId),
  });
}

export function useApfEvidenceSources(dossierId: string | null) {
  return useQuery({ queryKey: ["apf-evidence-sources", dossierId], queryFn: () => listApfEvidenceSources(dossierId!), enabled: Boolean(dossierId) });
}

export function useApfAcceptanceCriteria(dossierId: string | null) {
  return useQuery({
    queryKey: ["apf-acceptance-criteria", dossierId],
    queryFn: () => listApfAcceptanceCriteria(dossierId!),
    enabled: Boolean(dossierId),
  });
}

export function useApfDossierCreationOptions(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["apf-dossier-creation-options", organizationId],
    queryFn: () => getApfDossierCreationOptions(organizationId!),
    enabled: Boolean(organizationId) && enabled,
  });
}
