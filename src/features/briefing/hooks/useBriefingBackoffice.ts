import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBriefingBackofficeSummary,
  getBriefingBackofficeByOrganization,
  getBriefingBackofficeByProvider,
  getBriefingBackofficeTeamSummary,
  getOrgBriefingRetentionConfig,
  setOrgBriefingRetentionConfig,
  archiveExpiredBriefings,
  anonymizeAiBriefing,
  deleteAiBriefing,
  type BriefingBackofficeSummary,
  type BriefingBackofficeOrg,
  type BriefingBackofficeProvider,
  type BriefingBackofficeTeamSummary,
  type BriefingRetentionConfig,
} from "../services/briefing.service";

export function useBriefingBackofficeSummary() {
  return useQuery<BriefingBackofficeSummary>({
    queryKey: ["briefing-backoffice-summary"],
    queryFn: getBriefingBackofficeSummary,
    staleTime: 60_000,
  });
}

export function useBriefingBackofficeByOrganization() {
  return useQuery<BriefingBackofficeOrg[]>({
    queryKey: ["briefing-backoffice-by-org"],
    queryFn: getBriefingBackofficeByOrganization,
    staleTime: 60_000,
  });
}

export function useBriefingBackofficeByProvider() {
  return useQuery<BriefingBackofficeProvider[]>({
    queryKey: ["briefing-backoffice-by-provider"],
    queryFn: getBriefingBackofficeByProvider,
    staleTime: 60_000,
  });
}

export function useBriefingBackofficeTeamSummary(orgId?: string) {
  return useQuery<BriefingBackofficeTeamSummary[]>({
    queryKey: ["briefing-backoffice-team-summary", orgId],
    queryFn: () => getBriefingBackofficeTeamSummary(orgId),
    staleTime: 60_000,
    enabled: true,
  });
}

export function useOrgBriefingRetentionConfig(orgId: string) {
  return useQuery<BriefingRetentionConfig | null>({
    queryKey: ["briefing-retention-config", orgId],
    queryFn: () => getOrgBriefingRetentionConfig(orgId),
    staleTime: 60_000,
    enabled: !!orgId,
  });
}

export function useSetOrgBriefingRetentionConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      config,
    }: {
      orgId: string;
      config: {
        defaultRetentionDays: number;
        autoArchive: boolean;
        autoAnonymize: boolean;
        allowPermanentDelete: boolean;
      };
    }) => setOrgBriefingRetentionConfig(orgId, config),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["briefing-retention-config", variables.orgId],
      });
    },
  });
}

export function useArchiveExpiredBriefings() {
  return useMutation({
    mutationFn: archiveExpiredBriefings,
  });
}

export function useAnonymizeAiBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: anonymizeAiBriefing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing-backoffice"] });
    },
  });
}

export function useDeleteAiBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAiBriefing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing-backoffice"] });
    },
  });
}