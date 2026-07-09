import { supabase } from "@/integrations/supabase/client";
import type {
  BriefingSuggestionType,
  BriefingType,
} from "../types/briefing";

export type BriefingReviewStatus =
  | "pending"
  | "approved"
  | "edited"
  | "rejected"
  | "applied";

export interface BriefingEvidenceRecord {
  id: string;
  quoteText: string;
  speakerName: string | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  timestampStart: string | null;
  timestampEnd: string | null;
}

export interface BriefingSuggestionRecord {
  id: string;
  type: BriefingSuggestionType;
  title: string;
  description: string;
  assigneeName: string | null;
  dueDate: string | null;
  dateSource: "explicit" | "inferred" | "absent";
  priority: "low" | "medium" | "high" | "urgent" | null;
  reviewStatus: BriefingReviewStatus;
  evidence: BriefingEvidenceRecord[];
}

export interface BriefingRecord {
  id: string;
  title: string;
  type: BriefingType;
  status: string;
  sourceContent: string;
  meetingDate: string | null;
  language: string | null;
  suggestions: BriefingSuggestionRecord[];
}

export interface BriefingHistoryItem {
  id: string;
  title: string;
  type: BriefingType;
  status: string;
  meetingDate: string | null;
  createdAt: string;
  suggestionCount: number;
}

export interface CreateBriefingInput {
  organizationId: string;
  teamId: string;
  sprintId?: string | null;
  type: BriefingType;
  title: string;
  sourceContent: string;
  meetingDate?: string | null;
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createBriefing(input: CreateBriefingInput) {
  const [{ data: team, error: teamError }, sourceHash] = await Promise.all([
    supabase
      .from("teams")
      .select("project_id")
      .eq("id", input.teamId)
      .single(),
    sha256(input.sourceContent.trim()),
  ]);
  assertNoError(teamError);

  const { data, error } = await supabase.rpc("create_ai_briefing", {
    p_org_id: input.organizationId,
    p_briefing_type: input.type,
    p_title: input.title.trim(),
    p_source_content: input.sourceContent.trim(),
    p_source_hash: sourceHash,
    p_project_id: team?.project_id ?? null,
    p_team_id: input.teamId,
    p_sprint_id: input.sprintId ?? null,
    p_meeting_date: input.meetingDate || null,
    p_source_type: "pasted_text",
    p_language: null,
    p_participants: [],
  });
  assertNoError(error);
  return String(data);
}

export async function processBriefing(briefingId: string) {
  const { data, error } = await supabase.functions.invoke(
    "process-ai-briefing",
    { body: { briefingId } },
  );
  if (error) throw new Error(error.message);
  if (!data?.success) {
    throw new Error(
      String(data?.message ?? data?.error ?? "Falha ao processar briefing"),
    );
  }
  return data as {
    success: true;
    briefingId: string;
    runId: string;
    status: string;
    suggestionCount: number;
    summary: string;
  };
}

function normalizeEvidence(row: Record<string, unknown>): BriefingEvidenceRecord {
  return {
    id: String(row.id),
    quoteText: String(row.quote_text ?? ""),
    speakerName: row.speaker_name == null ? null : String(row.speaker_name),
    sourceStart:
      row.source_start == null ? null : Number(row.source_start),
    sourceEnd: row.source_end == null ? null : Number(row.source_end),
    timestampStart:
      row.timestamp_start == null ? null : String(row.timestamp_start),
    timestampEnd:
      row.timestamp_end == null ? null : String(row.timestamp_end),
  };
}

function normalizeSuggestion(
  row: Record<string, unknown>,
): BriefingSuggestionRecord {
  const evidence = Array.isArray(row.ai_suggestion_evidence)
    ? row.ai_suggestion_evidence
    : [];
  const reviewed =
    row.review_status === "edited" &&
    row.reviewed_payload &&
    typeof row.reviewed_payload === "object" &&
    !Array.isArray(row.reviewed_payload)
      ? (row.reviewed_payload as Record<string, unknown>)
      : null;
  const reviewedValue = (key: string, fallback: unknown) =>
    reviewed && Object.prototype.hasOwnProperty.call(reviewed, key)
      ? reviewed[key]
      : fallback;
  const assigneeName = reviewedValue(
    "assigneeName",
    row.suggested_assignee_name,
  );
  const dueDate = reviewedValue("dueDate", row.suggested_due_date);
  const priority = reviewedValue("priority", row.priority_hint);

  return {
    id: String(row.id),
    type: String(
      reviewedValue("type", row.suggestion_type),
    ) as BriefingSuggestionType,
    title: String(reviewedValue("title", row.title) ?? ""),
    description: String(reviewedValue("description", row.description) ?? ""),
    assigneeName: assigneeName == null ? null : String(assigneeName),
    dueDate: dueDate == null ? null : String(dueDate),
    dateSource: String(
      reviewedValue("dateSource", row.date_source),
    ) as BriefingSuggestionRecord["dateSource"],
    priority:
      priority == null
        ? null
        : (String(priority) as BriefingSuggestionRecord["priority"]),
    reviewStatus: String(
      row.review_status,
    ) as BriefingSuggestionRecord["reviewStatus"],
    evidence: (evidence as Array<Record<string, unknown>>).map(
      normalizeEvidence,
    ),
  };
}

export async function getBriefing(briefingId: string): Promise<BriefingRecord> {
  const { data: briefing, error: briefingError } = await supabase
    .from("ai_briefings")
    .select(
      "id,title,briefing_type,status,source_content,meeting_date,language",
    )
    .eq("id", briefingId)
    .single();
  assertNoError(briefingError);

  const { data: suggestions, error: suggestionsError } = await supabase
    .from("ai_briefing_suggestions")
    .select("*,ai_suggestion_evidence(*)")
    .eq("briefing_id", briefingId)
    .order("ordinal");
  assertNoError(suggestionsError);

  return {
    id: briefing.id,
    title: briefing.title,
    type: briefing.briefing_type as BriefingType,
    status: briefing.status,
    sourceContent: briefing.source_content,
    meetingDate: briefing.meeting_date,
    language: briefing.language,
    suggestions: ((suggestions ?? []) as Array<Record<string, unknown>>).map(
      normalizeSuggestion,
    ),
  };
}

export async function listTeamBriefings(
  teamId: string,
): Promise<BriefingHistoryItem[]> {
  const { data, error } = await supabase
    .from("ai_briefings")
    .select(
      "id,title,briefing_type,status,meeting_date,created_at,ai_briefing_suggestions(count)",
    )
    .eq("team_id", teamId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(20);
  assertNoError(error);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const counts = Array.isArray(row.ai_briefing_suggestions)
      ? row.ai_briefing_suggestions
      : [];
    const firstCount = counts[0] as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      title: String(row.title),
      type: String(row.briefing_type) as BriefingType,
      status: String(row.status),
      meetingDate: row.meeting_date == null ? null : String(row.meeting_date),
      createdAt: String(row.created_at),
      suggestionCount: Number(firstCount?.count ?? 0),
    };
  });
}

export async function reviewBriefingSuggestion(
  suggestionId: string,
  status: "approved" | "edited" | "rejected",
  reviewedPayload?: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("review_ai_briefing_suggestion", {
    p_suggestion_id: suggestionId,
    p_review_status: status,
    p_reviewed_payload: reviewedPayload ?? null,
  });
  assertNoError(error);
}

export async function applyBriefingSuggestion(suggestionId: string) {
  const { data, error } = await supabase.rpc("apply_ai_briefing_suggestion", {
    p_suggestion_id: suggestionId,
  });
  assertNoError(error);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("A aplicação não retornou o registro criado.");
  return result as {
    application_id: string;
    target_type: "user_story" | "impediment";
    target_id: string;
  };
}
