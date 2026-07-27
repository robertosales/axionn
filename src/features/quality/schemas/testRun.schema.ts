import { z } from "zod";

export const qualityTestRunSchema = z.object({
  organizationId: z.string().uuid(),
  testPlanId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  environmentName: z.string().trim().max(200).nullable().optional(),
  buildReference: z.string().trim().max(500).nullable().optional(),
  commitSha: z.string().trim().max(128).nullable().optional(),
});
