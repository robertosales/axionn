import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QualityOverview { activeCases: number; approvedCases: number; suites: number; activePlans: number; activeRuns: number; failedItems: number; activeFindings: number }
type QualityCountTable = "quality_test_cases" | "quality_test_suites" | "quality_test_plans" | "quality_test_runs" | "quality_test_run_items" | "quality_findings";
type QualityCountFilter = "active_cases" | "approved_cases" | "active_plans" | "active_runs" | "failed_items" | "active_findings";

async function countRows(table: QualityCountTable, organizationId: string, filter?: QualityCountFilter) {
  let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  if (filter === "active_cases") query = query.neq("status", "archived");
  if (filter === "approved_cases") query = query.eq("status", "approved");
  if (filter === "active_plans") query = query.in("status", ["draft", "ready"]);
  if (filter === "active_runs") query = query.in("status", ["draft", "planned", "in_progress"]);
  if (filter === "failed_items") query = query.eq("status", "failed");
  if (filter === "active_findings") query = query.in("status", ["open", "triaged", "in_progress"]);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function useQualityOverview(organizationId: string | null) {
  return useQuery({ queryKey: ["quality", organizationId, "overview"], enabled: Boolean(organizationId), staleTime: 30_000, queryFn: async (): Promise<QualityOverview> => {
    const [activeCases, approvedCases, suites, activePlans, activeRuns, failedItems, activeFindings] = await Promise.all([
      countRows("quality_test_cases", organizationId!, "active_cases"), countRows("quality_test_cases", organizationId!, "approved_cases"), countRows("quality_test_suites", organizationId!), countRows("quality_test_plans", organizationId!, "active_plans"), countRows("quality_test_runs", organizationId!, "active_runs"), countRows("quality_test_run_items", organizationId!, "failed_items"), countRows("quality_findings", organizationId!, "active_findings"),
    ]);
    return { activeCases, approvedCases, suites, activePlans, activeRuns, failedItems, activeFindings };
  } });
}
