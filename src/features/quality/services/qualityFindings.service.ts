import { supabase } from "@/integrations/supabase/client";

export interface QualityFindingRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  expected_result: string | null;
  actual_result: string | null;
  severity: string;
  status: string;
  test_run_id: string | null;
  run_item_id: string | null;
  step_result_id: string | null;
  external_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFindingInput {
  title: string;
  description?: string;
  expectedResult?: string;
  actualResult?: string;
  severity: string;
  runItemId?: string;
  stepResultId?: string;
  userStoryId?: string;
}

export async function listQualityFindings(orgId: string) {
  const { data, error } = await supabase.from("quality_findings").select("id,code,title,description,expected_result,actual_result,severity,status,test_run_id,run_item_id,step_result_id,external_issue_url,created_at,updated_at").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QualityFindingRow[];
}

export async function createQualityFinding(orgId: string, input: CreateFindingInput) {
  const { data, error } = await supabase.rpc("create_quality_finding_v1", {
    p_org_id: orgId,
    p_payload: {
      title: input.title,
      description: input.description,
      expected_result: input.expectedResult,
      actual_result: input.actualResult,
      severity: input.severity,
      run_item_id: input.runItemId,
      step_result_id: input.stepResultId,
      user_story_id: input.userStoryId,
    },
  });
  if (error) throw error;
  return String(data);
}

export async function updateQualityFindingStatus(orgId: string, findingId: string, status: string) {
  const { error } = await supabase.rpc("update_quality_finding_status_v1", { p_org_id: orgId, p_finding_id: findingId, p_status: status });
  if (error) throw error;
}
