import { z } from "zod";

const optionalUuid = z.string().uuid().nullable().optional();

export const qualityTestStepSchema = z.object({
  action: z.string().trim().min(1).max(10_000),
  inputData: z.string().max(10_000).nullable().optional(),
  expectedResult: z.string().trim().min(1).max(10_000),
  referenceUrl: z.string().url().max(2_048).nullable().optional(),
});

export const qualityTestCaseSchema = z.object({
  organizationId: z.string().uuid(),
  contractId: optionalUuid,
  projectId: optionalUuid,
  teamId: optionalUuid,
  title: z.string().trim().min(1).max(300),
  objective: z.string().max(20_000).nullable().optional(),
  preconditions: z.string().max(20_000).nullable().optional(),
  postconditions: z.string().max(20_000).nullable().optional(),
  testData: z.string().max(20_000).nullable().optional(),
  testType: z.enum(["functional", "regression", "integration", "api", "security", "accessibility", "compatibility", "usability", "performance", "uat", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["draft", "ready", "approved", "deprecated", "archived"]),
  executionMode: z.enum(["manual", "automated", "hybrid"]),
  estimatedMinutes: z.number().int().nonnegative().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  steps: z.array(qualityTestStepSchema).min(1).max(200),
});

export type QualityTestCasePayload = z.infer<typeof qualityTestCaseSchema>;
