import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQualityFinding, updateQualityFindingStatus } from "./services/qualityFindings.service";
import { saveTestCase } from "./services/qualityTestCases.service";
import { addPlanItem, createRunFromPlan, createTestPlan } from "./services/qualityTestPlans.service";
import { addEvidence, completeRun, startRun, updateStep } from "./services/qualityTestRuns.service";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("Quality Intelligence lifecycle integration", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); });

  it("executes the audited lifecycle from case to finding", async () => {
    rpc.mockResolvedValueOnce({ data: "case-1", error: null }).mockResolvedValueOnce({ data: "plan-1", error: null }).mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: "run-1", error: null }).mockResolvedValue({ data: null, error: null });
    const caseId = await saveTestCase("org-1", { title: "Login válido" });
    const planId = await createTestPlan("org-1", { name: "Regressão" });
    await addPlanItem("org-1", planId, caseId, 1);
    const runId = await createRunFromPlan("org-1", planId, { name: "Canário", environmentName: "Homologação", buildReference: "v1" });
    await startRun("org-1", runId);
    await updateStep("org-1", "step-1", "failed", "Resposta inesperada");
    await addEvidence("org-1", "item-1", "step-1", "Evidência", "https://example.invalid/evidence");
    const findingId = await createQualityFinding("org-1", { title: "Falha no login", severity: "high", runItemId: "item-1", stepResultId: "step-1" });
    await updateQualityFindingStatus("org-1", findingId, "triaged");
    await completeRun("org-1", runId, true);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["create_quality_test_case_v1", "create_quality_test_plan_v1", "add_quality_test_plan_item_v1", "create_quality_test_run_from_plan_v1", "start_quality_test_run_v1", "update_quality_step_result_v1", "add_quality_external_evidence_v1", "create_quality_finding_v1", "update_quality_finding_status_v1", "complete_quality_test_run_v1"]);
    for (const [, args] of rpc.mock.calls) expect(args).toMatchObject({ p_org_id: "org-1" });
  });

  it("stops the lifecycle when the database denies tenant access", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "quality_permission_denied" } });
    await expect(saveTestCase("foreign-org", { title: "Cross tenant" })).rejects.toMatchObject({ code: "42501" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
