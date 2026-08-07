import { supabase } from "@/integrations/supabase/client";

export interface QualityCoverageRow {
  id: string;
  code: string;
  title: string;
  status: string;
  severity: string;
  quality_test_case_links: Array<{ id: string; entity_type: string; entity_reference: string | null }>;
  quality_test_plan_items: Array<{ id: string; test_case_version: number }>;
  quality_test_run_items: Array<{ id: string; status: string; completed_at: string | null }>;
}

export async function listQualityCoverage(orgId: string) {
  const { data, error } = await supabase
    .from("quality_test_cases")
    .select("id,code,title,status,severity,quality_test_case_links(id,entity_type,entity_reference),quality_test_plan_items(id,test_case_version),quality_test_run_items(id,status,completed_at)")
    .eq("organization_id", orgId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QualityCoverageRow[];
}
