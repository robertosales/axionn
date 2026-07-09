export const BRIEFING_TYPES = [
  "daily",
  "planning",
  "review",
  "retro",
  "discovery",
  "free",
] as const;

export type BriefingType = (typeof BRIEFING_TYPES)[number];

export const BRIEFING_SUGGESTION_TYPES = [
  "decision",
  "action",
  "impediment",
  "risk",
  "open_question",
  "backlog_candidate",
] as const;

export type BriefingSuggestionType =
  (typeof BRIEFING_SUGGESTION_TYPES)[number];

export type BriefingDateSource = "explicit" | "inferred" | "absent";
export type BriefingPriority = "low" | "medium" | "high" | "urgent";

export interface BriefingEvidence {
  quote: string;
  speaker?: string;
  sourceStart?: number;
  sourceEnd?: number;
  timestampStart?: string;
  timestampEnd?: string;
}

export interface BriefingSuggestion {
  type: BriefingSuggestionType;
  title: string;
  description: string;
  assigneeName?: string;
  dueDate?: string;
  dateSource: BriefingDateSource;
  priority?: BriefingPriority;
  evidence: BriefingEvidence[];
}

export interface BriefingAnalysis {
  schemaVersion: "1.0";
  language: string;
  summary: string;
  suggestions: BriefingSuggestion[];
}
