import { z } from "zod";

import {
  BRIEFING_SUGGESTION_TYPES,
  type BriefingAnalysis,
} from "../types/briefing";

const evidenceSchema = z
  .object({
    quote: z.string().trim().min(1).max(4_000),
    speaker: z.string().trim().min(1).max(200).optional(),
    sourceStart: z.number().int().nonnegative().optional(),
    sourceEnd: z.number().int().positive().optional(),
    timestampStart: z.string().trim().min(1).max(40).optional(),
    timestampEnd: z.string().trim().min(1).max(40).optional(),
  })
  .superRefine((evidence, context) => {
    const hasStart = evidence.sourceStart !== undefined;
    const hasEnd = evidence.sourceEnd !== undefined;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceStart e sourceEnd devem ser informados juntos",
      });
    }

    if (
      hasStart &&
      hasEnd &&
      evidence.sourceEnd! <= evidence.sourceStart!
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceEnd deve ser maior que sourceStart",
      });
    }
  });

const suggestionSchema = z
  .object({
    type: z.enum(BRIEFING_SUGGESTION_TYPES),
    title: z.string().trim().min(3).max(240),
    description: z.string().trim().max(10_000).default(""),
    assigneeName: z.string().trim().min(1).max(200).optional(),
    dueDate: z.string().date().optional(),
    dateSource: z.enum(["explicit", "inferred", "absent"]),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    evidence: z.array(evidenceSchema).min(1).max(10),
  })
  .superRefine((suggestion, context) => {
    if (suggestion.dateSource === "absent" && suggestion.dueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dueDate nao pode existir quando dateSource for absent",
        path: ["dueDate"],
      });
    }

    if (suggestion.dateSource !== "absent" && !suggestion.dueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dueDate e obrigatoria para datas explicitas ou inferidas",
        path: ["dueDate"],
      });
    }
  });

export const briefingAnalysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  summary: z.string().trim().min(10).max(10_000),
  suggestions: z.array(suggestionSchema).max(100),
});

export function parseBriefingAnalysis(input: unknown): BriefingAnalysis {
  return briefingAnalysisSchema.parse(input) as BriefingAnalysis;
}
