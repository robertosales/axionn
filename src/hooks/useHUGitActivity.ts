import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HUMergeRequest {
  id: string;
  mr_iid: number;
  title: string;
  state: string;
  action: string | null;
  source_branch: string;
  target_branch: string;
  author_username: string | null;
  web_url: string | null;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
}

export interface HUCommit {
  id: string;
  commit_sha: string;
  short_sha: string | null;
  message: string;
  author_name: string | null;
  author_email: string | null;
  committed_at: string;
  web_url: string | null;
}

export interface HUGitSummary {
  hu_id: string;
  mr_count: number | null;
  commit_count: number | null;
  deployment_count: number | null;
  last_git_activity_at: string | null;
  latest_mr: any;
  latest_production_deployment: any;
}

export function useHUGitActivity(huId: string | null | undefined, organizationId: string | null | undefined) {
  const hasIntegration = useQuery({
    queryKey: ["git-integration-exists", organizationId],
    queryFn: async () => {
      const { count } = await supabase
        .from("git_integrations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId!)
        .eq("is_active", true);
      return (count ?? 0) > 0;
    },
    staleTime: 300_000,
    enabled: !!organizationId,
  });

  const enabled = !!huId && !!hasIntegration.data;

  const mergeRequests = useQuery({
    queryKey: ["hu-mrs", huId],
    queryFn: async (): Promise<HUMergeRequest[]> => {
      const { data: links } = await supabase
        .from("hu_git_links")
        .select("git_entity_id")
        .eq("hu_id", huId!)
        .eq("git_entity_type", "merge_request");
      const mrIds = (links ?? []).map((l: any) => l.git_entity_id).filter(Boolean);
      if (mrIds.length === 0) return [];
      const { data } = await supabase
        .from("git_merge_requests")
        .select("id, mr_iid, title, state, action, source_branch, target_branch, author_username, web_url, created_at, merged_at, closed_at")
        .in("id", mrIds)
        .order("updated_at", { ascending: false });
      return (data ?? []) as HUMergeRequest[];
    },
    enabled,
    staleTime: 60_000,
  });

  const commits = useQuery({
    queryKey: ["hu-commits", huId],
    queryFn: async (): Promise<HUCommit[]> => {
      const { data: links } = await supabase
        .from("hu_git_links")
        .select("git_entity_id")
        .eq("hu_id", huId!)
        .eq("git_entity_type", "commit");
      const shas = (links ?? []).map((l: any) => l.git_entity_id).filter(Boolean);
      if (shas.length === 0) return [];
      const { data } = await supabase
        .from("git_commits")
        .select("id, commit_sha, short_sha, message, author_name, author_email, committed_at, web_url")
        .in("commit_sha", shas)
        .order("committed_at", { ascending: false })
        .limit(10);
      return (data ?? []) as HUCommit[];
    },
    enabled,
    staleTime: 60_000,
  });

  const gitSummary = useQuery({
    queryKey: ["hu-git-summary", huId],
    queryFn: async (): Promise<HUGitSummary | null> => {
      const { data } = await supabase
        .from("v_hu_git_summary" as any)
        .select("*")
        .eq("hu_id", huId!)
        .maybeSingle();
      return (data as HUGitSummary | null) ?? null;
    },
    enabled,
    staleTime: 60_000,
  });

  return {
    hasIntegration: hasIntegration.data ?? false,
    isLoadingIntegration: hasIntegration.isLoading,
    mergeRequests: mergeRequests.data ?? [],
    commits: commits.data ?? [],
    gitSummary: gitSummary.data ?? null,
    isLoading: mergeRequests.isLoading || commits.isLoading || gitSummary.isLoading,
  };
}