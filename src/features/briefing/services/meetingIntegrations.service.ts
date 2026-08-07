import { supabase } from "@/integrations/supabase/client";

export type MeetingConnectionStatus =
  | "connecting"
  | "healthy"
  | "syncing"
  | "attention_required"
  | "insufficient_permission"
  | "token_expired"
  | "access_revoked"
  | "disabled";

export interface MeetingConnectionSummary {
  id: string;
  provider: "microsoft_teams" | "google_meet";
  connectionMode: "delegated" | "application";
  displayName: string;
  grantedScopes: string[];
  status: MeetingConnectionStatus;
  syncPolicy: "manual" | "automatic";
  initialDaysBack: number;
  retentionDays: number;
  healthCheckedAt: string | null;
  lastSyncedAt: string | null;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
}

export interface ExternalMeetingSummary {
  id: string;
  provider: "microsoft_teams" | "google_meet";
  subject: string;
  organizerName: string | null;
  startsAt: string;
  endsAt: string | null;
  state: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  teamId: string | null;
  projectId: string | null;
  sprintId: string | null;
}

interface ConnectorEnvelope<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
    retryAfterSeconds?: number;
    correlationId: string;
  };
  correlationId?: string;
}

async function invokeConnector<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ConnectorEnvelope<T>>(
    "teams-meeting-connector",
    { body },
  );
  if (error) throw new Error(error.message);
  if (data?.error) {
    const connectorError = new Error(data.error.message);
    connectorError.name = data.error.code;
    throw connectorError;
  }
  if (!data?.data) throw new Error("Resposta inválida do conector Teams.");
  return data.data;
}

export async function startTeamsAuthorization(orgId: string, redirectUri: string) {
  return invokeConnector<{ authorizationUrl: string }>({
    action: "authorize",
    orgId,
    redirectUri,
  });
}

export async function completeTeamsAuthorization(code: string, state: string) {
  return invokeConnector<{
    connectionId: string;
    status: "healthy";
    displayName: string;
  }>({ action: "callback", code, state });
}

export async function syncTeamsMeetings(connectionId: string) {
  return invokeConnector<{ discovered: number; meetingIds: string[] }>({
    action: "sync",
    connectionId,
  });
}

export async function testTeamsConnection(connectionId: string) {
  return invokeConnector<{ status: "healthy"; account: string }>({
    action: "health",
    connectionId,
  });
}

export async function importTeamsMeeting(input: {
  meetingId: string;
  teamId: string;
  projectId?: string;
  sprintId?: string;
  briefingType: string;
}) {
  return invokeConnector<{ briefingId: string; jobId?: string; duplicate: boolean }>({
    action: "import",
    ...input,
  });
}

export async function listMeetingConnections(
  orgId: string,
): Promise<MeetingConnectionSummary[]> {
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>)(
    "list_meeting_connections_v1",
    { p_org_id: orgId },
  );
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider) as MeetingConnectionSummary["provider"],
    connectionMode: String(row.connection_mode) as MeetingConnectionSummary["connectionMode"],
    displayName: String(row.display_name),
    grantedScopes: Array.isArray(row.granted_scopes)
      ? row.granted_scopes.map(String)
      : [],
    status: String(row.status) as MeetingConnectionStatus,
    syncPolicy: String(row.sync_policy) as MeetingConnectionSummary["syncPolicy"],
    initialDaysBack: Number(row.initial_days_back),
    retentionDays: Number(row.retention_days),
    healthCheckedAt: row.health_checked_at ? String(row.health_checked_at) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    safeErrorCode: row.safe_error_code ? String(row.safe_error_code) : null,
    safeErrorMessage: row.safe_error_message ? String(row.safe_error_message) : null,
  }));
}

export async function listExternalMeetings(
  orgId: string,
): Promise<ExternalMeetingSummary[]> {
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
        };
      };
    };
  };
  const { data, error } = await client
    .from("external_meetings")
    .select(
      "id,subject,organizer_display_name,starts_at,ends_at,state,has_recording,has_transcript,team_id,project_id,sprint_id,meeting_connections!inner(provider)",
    )
    .eq("org_id", orgId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const connection = row.meeting_connections as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      provider: String(connection?.provider) as ExternalMeetingSummary["provider"],
      subject: String(row.subject),
      organizerName: row.organizer_display_name
        ? String(row.organizer_display_name)
        : null,
      startsAt: String(row.starts_at),
      endsAt: row.ends_at ? String(row.ends_at) : null,
      state: String(row.state),
      hasRecording: Boolean(row.has_recording),
      hasTranscript: Boolean(row.has_transcript),
      teamId: row.team_id ? String(row.team_id) : null,
      projectId: row.project_id ? String(row.project_id) : null,
      sprintId: row.sprint_id ? String(row.sprint_id) : null,
    };
  });
}
