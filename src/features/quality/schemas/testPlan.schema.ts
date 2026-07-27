import { z } from "zod";

export const qualityTestPlanSchema = z.object({
  organizationId: z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).nullable().optional(),
  releaseId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
});
