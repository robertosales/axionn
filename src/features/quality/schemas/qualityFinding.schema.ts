import { z } from "zod";

export const qualityFindingSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).nullable().optional(),
  expectedResult: z.string().max(20_000).nullable().optional(),
  actualResult: z.string().max(20_000).nullable().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  runItemId: z.string().uuid().nullable().optional(),
  stepResultId: z.string().uuid().nullable().optional(),
  userStoryId: z.string().uuid().nullable().optional(),
});
