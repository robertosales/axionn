export type QualityTestCaseStatus = "draft" | "ready" | "approved" | "deprecated" | "archived";
export type QualityTestType = "functional" | "regression" | "integration" | "api" | "security" | "accessibility" | "compatibility" | "usability" | "performance" | "uat" | "other";
export type QualityExecutionMode = "manual" | "automated" | "hybrid";
export type QualityRunStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled";
export type QualityResultStatus = "not_run" | "in_progress" | "passed" | "failed" | "blocked" | "skipped" | "invalid" | "retest";
export type QualityFindingStatus = "open" | "triaged" | "in_progress" | "resolved" | "closed" | "rejected";
export type QualitySeverity = "low" | "medium" | "high" | "critical";
export type QualityPriority = "low" | "medium" | "high" | "critical";

export interface QualityTestStepInput {
  action: string;
  inputData?: string | null;
  expectedResult: string;
  referenceUrl?: string | null;
}

export interface QualityTestCaseInput {
  organizationId: string;
  contractId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  title: string;
  objective?: string | null;
  preconditions?: string | null;
  postconditions?: string | null;
  testData?: string | null;
  testType: QualityTestType;
  priority: QualityPriority;
  severity: QualitySeverity;
  status: QualityTestCaseStatus;
  executionMode: QualityExecutionMode;
  estimatedMinutes?: number | null;
  tags: string[];
  steps: QualityTestStepInput[];
}

export interface QualityTestPlanInput {
  organizationId: string;
  contractId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  name: string;
  description?: string | null;
  releaseId?: string | null;
  sprintId?: string | null;
}

export interface QualityTestRunInput {
  organizationId: string;
  testPlanId: string;
  name: string;
  environmentName?: string | null;
  buildReference?: string | null;
  commitSha?: string | null;
}

export interface QualityFindingInput {
  organizationId: string;
  title: string;
  description?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  severity: QualitySeverity;
  runItemId?: string | null;
  stepResultId?: string | null;
  userStoryId?: string | null;
}
