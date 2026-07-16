import { supabase } from "@/integrations/supabase/client";

export interface QualityPlanRow { id:string; name:string; description:string|null; status:string; release_id:string|null; sprint_id:string|null; updated_at:string; quality_test_plan_items:Array<{id:string;test_case_id:string;test_case_version:number;sort_order:number;is_required:boolean}> }

export async function listTestPlans(orgId:string){const {data,error}=await supabase.from("quality_test_plans").select("id,name,description,status,release_id,sprint_id,updated_at,quality_test_plan_items(id,test_case_id,test_case_version,sort_order,is_required)").eq("organization_id",orgId).neq("status","archived").order("updated_at",{ascending:false});if(error)throw error;return (data??[]) as QualityPlanRow[];}
export async function createTestPlan(orgId:string,payload:Record<string,unknown>){const {data,error}=await supabase.rpc("create_quality_test_plan_v1",{p_org_id:orgId,p_payload:payload});if(error)throw error;return String(data);}
export async function addPlanItem(orgId:string,planId:string,caseId:string,version:number){const {error}=await supabase.rpc("add_quality_test_plan_item_v1",{p_org_id:orgId,p_plan_id:planId,p_case_id:caseId,p_case_version:version,p_is_required:true});if(error)throw error;}
export async function removePlanItem(orgId:string,planId:string,caseId:string){const {error}=await supabase.rpc("remove_quality_test_plan_item_v1",{p_org_id:orgId,p_plan_id:planId,p_case_id:caseId});if(error)throw error;}
export async function createRunFromPlan(orgId:string,planId:string,name:string){const {data,error}=await supabase.rpc("create_quality_test_run_from_plan_v1",{p_org_id:orgId,p_plan_id:planId,p_name:name});if(error)throw error;return String(data);}
