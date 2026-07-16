import { supabase } from "@/integrations/supabase/client";

export interface QualityCaseRow {
  id: string; code: string; title: string; test_type: string; priority: string; severity: string;
  status: string; execution_mode: string; current_version: number; updated_at: string; tags: string[];
}

export interface QualityCaseDetail extends QualityCaseRow {
  organization_id: string; objective: string | null; preconditions: string | null; postconditions: string | null;
  test_data: string | null; estimated_minutes: number | null; contract_id: string | null; project_id: string | null;
  team_id: string | null; quality_test_steps: Array<{ id: string; step_order: number; action: string; input_data: string | null; expected_result: string; reference_url: string | null }>;
  quality_test_case_links: Array<{ id: string; entity_type: string; entity_id: string; entity_reference: string | null; link_metadata: Record<string, unknown> }>;
}

export async function listTestCases(organizationId: string, search = "") {
  let query = supabase.from("quality_test_cases").select("id,code,title,test_type,priority,severity,status,execution_mode,current_version,updated_at,tags").eq("organization_id", organizationId).neq("status", "archived").order("updated_at", { ascending: false });
  if (search.trim()) query = query.or(`code.ilike.%${search.trim()}%,title.ilike.%${search.trim()}%`);
  const { data, error } = await query.limit(100); if (error) throw error; return (data ?? []) as QualityCaseRow[];
}

export async function getTestCase(organizationId: string, id: string) {
  const { data, error } = await supabase.from("quality_test_cases").select("*,quality_test_steps(*),quality_test_case_links(*)").eq("organization_id", organizationId).eq("id", id).order("step_order", { referencedTable: "quality_test_steps" }).single();
  if (error) throw error; return data as QualityCaseDetail;
}

export async function saveTestCase(organizationId: string, payload: Record<string, unknown>, id?: string) {
  const args = id ? { p_org_id: organizationId, p_case_id: id, p_payload: payload, p_change_summary: "Atualização pelo editor" } : { p_org_id: organizationId, p_payload: payload };
  const { data, error } = await supabase.rpc(id ? "update_quality_test_case_v1" : "create_quality_test_case_v1", args); if (error) throw error; return String(data);
}

export async function archiveTestCase(organizationId: string, id: string) { const { error } = await supabase.rpc("archive_quality_test_case_v1", { p_org_id: organizationId, p_case_id: id }); if (error) throw error; }
export async function linkTestCase(organizationId: string, caseId: string, entityType: string, entityId: string) { const { error } = await supabase.rpc("link_quality_test_case_v1", { p_org_id: organizationId, p_case_id: caseId, p_entity_type: entityType, p_entity_id: entityId }); if (error) throw error; }
export async function unlinkTestCase(organizationId: string, linkId: string) { const { error } = await supabase.rpc("unlink_quality_test_case_v1", { p_org_id: organizationId, p_link_id: linkId }); if (error) throw error; }
