import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

import {
  TEAMS_DELEGATED_SCOPES,
  TeamsGraphClient,
  TeamsGraphError,
  type TeamsOnlineMeeting,
} from "../_shared/teams-graph.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("TEAMS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TEAMS_CLIENT_SECRET") ?? "";

type AnyClient = ReturnType<typeof createClient>;

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  token_type: string;
}

interface RequestBody {
  action: "authorize" | "callback" | "sync" | "import" | "health";
  orgId?: string;
  redirectUri?: string;
  code?: string;
  state?: string;
  connectionId?: string;
  meetingId?: string;
  teamId?: string;
  projectId?: string;
  sprintId?: string;
  briefingType?: string;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomUrlSafe(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function assertRedirectUri(uri: string) {
  const allowed = (Deno.env.get("TEAMS_OAUTH_REDIRECT_URIS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowed.includes(uri)) throw new Error("TEAMS_REDIRECT_URI_NOT_ALLOWED");
}

async function exchangeToken(parameters: Record<string, string>): Promise<TokenPayload> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("TEAMS_OAUTH_NOT_CONFIGURED");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: TEAMS_DELEGATED_SCOPES.join(" "),
    ...parameters,
  });
  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  const payload = await tokenResponse.json();
  if (!tokenResponse.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error("TEAMS_OAUTH_TOKEN_EXCHANGE_FAILED");
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: String(payload.scope ?? TEAMS_DELEGATED_SCOPES.join(" ")),
    token_type: String(payload.token_type ?? "Bearer"),
  };
}

async function requirePermission(
  userClient: AnyClient,
  orgId: string,
  permission: string,
) {
  const { data, error } = await userClient.rpc("can_briefing_meeting_permission_v1", {
    p_org_id: orgId,
    p_permission: permission,
  });
  if (error || data !== true) throw new Error("MEETING_ACCESS_DENIED");
}

async function requireTeamsEntitlement(userClient: AnyClient, orgId: string) {
  for (const feature of ["briefing.integrations.enabled", "briefing.integrations.teams"]) {
    const { data, error } = await userClient.rpc("has_organization_entitlement", {
      p_org_id: orgId,
      p_feature_key: feature,
    });
    if (error || data !== true) throw new Error("MEETING_INTEGRATION_ENTITLEMENT_REQUIRED");
  }
}

async function connectionToken(admin: AnyClient, connectionId: string): Promise<TokenPayload> {
  const { data, error } = await admin.rpc("get_meeting_connection_secret_v1", {
    p_connection_id: connectionId,
  });
  if (error || !data) throw new Error("MEETING_CONNECTION_SECRET_MISSING");
  const token = JSON.parse(String(data)) as TokenPayload;
  if (Date.parse(token.expires_at) > Date.now() + 60_000) return token;

  const refreshed = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const { error: updateError } = await admin.rpc("update_meeting_connection_secret_v1", {
    p_connection_id: connectionId,
    p_token_payload: JSON.stringify(refreshed),
    p_granted_scopes: refreshed.scope.split(/\s+/).filter(Boolean),
  });
  if (updateError) throw new Error("MEETING_CONNECTION_TOKEN_UPDATE_FAILED");
  return refreshed;
}

function participants(meeting: TeamsOnlineMeeting) {
  const organizer = meeting.participants?.organizer?.identity?.user;
  const attendees = meeting.participants?.attendees ?? [];
  const values = [] as Array<{
    externalId: string;
    displayName: string;
    role: "organizer" | "presenter" | "attendee" | "unknown";
  }>;
  if (organizer?.id) {
    values.push({
      externalId: organizer.id,
      displayName: organizer.displayName ?? "Organizador",
      role: "organizer",
    });
  }
  attendees.forEach((attendee, index) => {
    const user = attendee.identity?.user;
    if (!user?.id || values.some((value) => value.externalId === user.id)) return;
    values.push({
      externalId: user.id,
      displayName: user.displayName ?? `Participante ${index + 1}`,
      role: attendee.role === "presenter" ? "presenter" : "attendee",
    });
  });
  return values;
}

async function persistMeeting(
  admin: AnyClient,
  orgId: string,
  connectionId: string,
  meeting: TeamsOnlineMeeting,
  transcriptCount: number,
) {
  const { data: existing } = await admin
    .from("external_meetings")
    .select("id,state")
    .eq("connection_id", connectionId)
    .eq("external_meeting_id", meeting.id)
    .maybeSingle();
  const record = {
    org_id: orgId,
    connection_id: connectionId,
    external_meeting_id: meeting.id,
    subject: meeting.subject || "Reunião Teams",
    organizer_external_id: meeting.participants?.organizer?.identity?.user?.id ?? null,
    organizer_display_name:
      meeting.participants?.organizer?.identity?.user?.displayName ?? null,
    starts_at: meeting.startDateTime,
    ends_at: meeting.endDateTime ?? null,
    source_version: "graph-v1",
    has_recording: false,
    has_transcript: transcriptCount > 0,
    updated_at: new Date().toISOString(),
  };
  let meetingId: string;
  if (existing) {
    const update = ["discovered", "artifacts_pending", "ready"].includes(existing.state)
      ? { ...record, state: transcriptCount > 0 ? "ready" : "artifacts_pending" }
      : record;
    const { error } = await admin.from("external_meetings").update(update).eq("id", existing.id);
    if (error) throw error;
    meetingId = existing.id;
  } else {
    const { data, error } = await admin
      .from("external_meetings")
      .insert({ ...record, state: transcriptCount > 0 ? "ready" : "artifacts_pending" })
      .select("id")
      .single();
    if (error) throw error;
    meetingId = data.id;
  }

  for (const participant of participants(meeting)) {
    const { error } = await admin.from("meeting_participants").upsert(
      {
        org_id: orgId,
        meeting_id: meetingId,
        external_participant_id: participant.externalId,
        display_name: participant.displayName,
        role: participant.role,
      },
      { onConflict: "meeting_id,external_participant_id" },
    );
    if (error) throw error;
  }
  return meetingId;
}

async function handleAuthorize(
  body: RequestBody,
  userId: string,
  userClient: AnyClient,
) {
  if (!body.orgId || !body.redirectUri) throw new Error("MEETING_REQUEST_INVALID");
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("TEAMS_OAUTH_NOT_CONFIGURED");
  assertRedirectUri(body.redirectUri);
  await requirePermission(userClient, body.orgId, "briefing.connections.manage");
  const verifier = randomUrlSafe(64);
  const state = randomUrlSafe(48);
  const { error } = await userClient.rpc("store_meeting_oauth_state_v1", {
    p_org_id: body.orgId,
    p_user_id: userId,
    p_state_hash: await sha256(state),
    p_code_verifier: verifier,
    p_redirect_uri: body.redirectUri,
  });
  if (error) throw error;

  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", body.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", TEAMS_DELEGATED_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await codeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return { authorizationUrl: url.toString() };
}

async function handleCallback(
  body: RequestBody,
  userId: string,
  admin: AnyClient,
) {
  if (!body.code || !body.state) throw new Error("MEETING_REQUEST_INVALID");
  const { data: rows, error } = await admin.rpc("consume_meeting_oauth_state_v1", {
    p_state_hash: await sha256(body.state),
    p_user_id: userId,
  });
  const oauthState = rows?.[0];
  if (error || !oauthState) throw new Error("MEETING_OAUTH_STATE_INVALID");
  const token = await exchangeToken({
    grant_type: "authorization_code",
    code: body.code,
    redirect_uri: oauthState.redirect_uri,
    code_verifier: oauthState.code_verifier,
  });
  const graph = new TeamsGraphClient(token.access_token);
  const me = await graph.getMe();
  const { data: connectionId, error: connectionError } = await admin.rpc(
    "upsert_teams_meeting_connection_v1",
    {
      p_org_id: oauthState.org_id,
      p_user_id: userId,
      p_external_tenant_id: null,
      p_external_account_id: me.id,
      p_display_name: me.displayName,
      p_granted_scopes: token.scope.split(/\s+/).filter(Boolean),
      p_token_payload: JSON.stringify(token),
    },
  );
  if (connectionError) throw connectionError;
  return { connectionId, status: "healthy", displayName: me.displayName };
}

async function loadConnection(admin: AnyClient, connectionId: string) {
  const { data, error } = await admin
    .from("meeting_connections")
    .select("id,org_id,provider,status,initial_days_back")
    .eq("id", connectionId)
    .single();
  if (error || data.provider !== "microsoft_teams") {
    throw new Error("MEETING_CONNECTION_NOT_FOUND");
  }
  return data;
}

async function handleSync(
  body: RequestBody,
  userClient: AnyClient,
  admin: AnyClient,
) {
  if (!body.connectionId) throw new Error("MEETING_REQUEST_INVALID");
  const connection = await loadConnection(admin, body.connectionId);
  await requirePermission(userClient, connection.org_id, "briefing.meetings.list");
  await requireTeamsEntitlement(userClient, connection.org_id);
  const token = await connectionToken(admin, connection.id);
  const graph = new TeamsGraphClient(token.access_token);
  const end = new Date();
  const start = new Date(end.getTime() - connection.initial_days_back * 86_400_000);
  const events = await graph.listCalendarEvents(start.toISOString(), end.toISOString(), 50);
  const imported: string[] = [];

  for (const event of events) {
    const meeting = await graph.resolveOnlineMeeting(event.onlineMeeting!.joinUrl!);
    if (!meeting) continue;
    const transcripts = await graph.listTranscripts(meeting.id);
    const meetingId = await persistMeeting(
      admin,
      connection.org_id,
      connection.id,
      meeting,
      transcripts.length,
    );
    for (const transcript of transcripts) {
      const { error } = await admin.from("meeting_artifacts").upsert(
        {
          org_id: connection.org_id,
          meeting_id: meetingId,
          external_artifact_id: transcript.id,
          kind: "transcript",
          status: "available",
          provider_reference: null,
          source_version: transcript.createdDateTime ?? "graph-v1",
          available_at: transcript.createdDateTime ?? new Date().toISOString(),
        },
        { onConflict: "meeting_id,external_artifact_id,source_version" },
      );
      if (error) throw error;
    }
    imported.push(meetingId);
  }
  await admin
    .from("meeting_connections")
    .update({ status: "healthy", last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);
  return { discovered: imported.length, meetingIds: imported };
}

function parseWebVtt(content: string) {
  const blocks = content.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const result: Array<{ externalId: string; speaker: string; text: string; startMs: number; endMs: number }> = [];
  const timing = /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/;
  const toMs = (value: string) => {
    const parts = value.split(":");
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
  };
  blocks.forEach((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const index = lines.findIndex((line) => timing.test(line));
    if (index < 0) return;
    const match = lines[index].match(timing)!;
    const raw = lines.slice(index + 1).join(" ");
    const voice = raw.match(/^<v(?:\.[^\s>]+)*\s+([^>]+)>([\s\S]*)$/i);
    const text = (voice?.[2] ?? raw).replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) return;
    result.push({
      externalId: index > 0 ? lines[index - 1] : `cue-${result.length}`,
      speaker: voice?.[1]?.trim() ?? "Speaker não identificado",
      text,
      startMs: toMs(match[1]),
      endMs: toMs(match[2]),
    });
  });
  return result.sort((a, b) => a.startMs - b.startMs);
}

function timestamp(ms: number) {
  const total = Math.floor(ms / 1000);
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

async function handleImport(
  body: RequestBody,
  userClient: AnyClient,
  admin: AnyClient,
) {
  if (!body.meetingId || !body.teamId) throw new Error("MEETING_REQUEST_INVALID");
  const { data: meeting, error: meetingError } = await admin
    .from("external_meetings")
    .select("*,meeting_connections!inner(id,org_id)")
    .eq("id", body.meetingId)
    .single();
  if (meetingError) throw new Error("MEETING_NOT_FOUND");
  await requirePermission(userClient, meeting.org_id, "briefing.meetings.import");
  await requireTeamsEntitlement(userClient, meeting.org_id);

  const { data: existingLink } = await admin
    .from("briefing_source_links")
    .select("briefing_id")
    .eq("meeting_id", meeting.id)
    .maybeSingle();
  if (existingLink) return { briefingId: existingLink.briefing_id, duplicate: true };

  const { data: jobId, error: jobError } = await userClient.rpc("request_meeting_import_v1", {
    p_meeting_id: meeting.id,
    p_team_id: body.teamId,
    p_project_id: body.projectId ?? null,
    p_sprint_id: body.sprintId ?? null,
    p_idempotency_key: `teams-import:${meeting.id}:${meeting.source_version}`,
  });
  if (jobError) throw jobError;

  const { data: artifact, error: artifactError } = await admin
    .from("meeting_artifacts")
    .select("id,external_artifact_id,source_version")
    .eq("meeting_id", meeting.id)
    .eq("kind", "transcript")
    .eq("status", "available")
    .order("available_at", { ascending: false })
    .limit(1)
    .single();
  if (artifactError) throw new Error("MEETING_TRANSCRIPT_NOT_READY");

  const token = await connectionToken(admin, meeting.connection_id);
  const graph = new TeamsGraphClient(token.access_token);
  const webVtt = await graph.getTranscriptWebVtt(
    meeting.external_meeting_id,
    artifact.external_artifact_id,
  );
  const cues = parseWebVtt(webVtt);
  if (!cues.length) throw new Error("MEETING_TRANSCRIPT_EMPTY");

  const { data: participantRows } = await admin
    .from("meeting_participants")
    .select("id,display_name,role")
    .eq("meeting_id", meeting.id);
  let sourceContent = "";
  const segmentRows = [];
  for (let ordinal = 0; ordinal < cues.length; ordinal += 1) {
    const cue = cues[ordinal];
    const line = `[${timestamp(cue.startMs)}] ${cue.speaker}: ${cue.text}`;
    const textStart = sourceContent.length + (ordinal ? 1 : 0);
    sourceContent += `${ordinal ? "\n" : ""}${line}`;
    segmentRows.push({
      org_id: meeting.org_id,
      artifact_id: artifact.id,
      external_segment_id: cue.externalId,
      participant_id:
        participantRows?.find((participant) => participant.display_name === cue.speaker)?.id ?? null,
      speaker_label: cue.speaker,
      text_content: cue.text,
      start_ms: cue.startMs,
      end_ms: cue.endMs,
      ordinal,
      text_start: textStart,
      text_end: sourceContent.length,
      quote_hash: await sha256(cue.text),
    });
  }
  const sourceHash = await sha256(sourceContent);
  const { error: segmentError } = await admin.from("meeting_transcript_segments").upsert(
    segmentRows,
    { onConflict: "artifact_id,external_segment_id" },
  );
  if (segmentError) throw segmentError;
  await admin.from("meeting_artifacts").update({ content_hash: sourceHash }).eq("id", artifact.id);

  const { data: briefingId, error: briefingError } = await userClient.rpc("create_ai_briefing", {
    p_org_id: meeting.org_id,
    p_briefing_type: body.briefingType ?? "free",
    p_title: meeting.subject,
    p_source_content: sourceContent,
    p_source_hash: sourceHash,
    p_project_id: body.projectId ?? null,
    p_team_id: body.teamId,
    p_sprint_id: body.sprintId ?? null,
    p_meeting_date: meeting.starts_at,
    p_source_type: "meeting_transcript",
    p_language: null,
    p_participants: participantRows ?? [],
  });
  if (briefingError) throw briefingError;
  const { error: linkError } = await admin.from("briefing_source_links").insert({
    org_id: meeting.org_id,
    briefing_id: briefingId,
    meeting_id: meeting.id,
    artifact_id: artifact.id,
    source_version: artifact.source_version,
    normalized_hash: sourceHash,
  });
  if (linkError) throw linkError;
  await admin.from("external_meetings").update({ state: "processing" }).eq("id", meeting.id);
  return { briefingId, jobId, duplicate: false };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    if (request.method !== "POST") return response({ error: { code: "METHOD_NOT_ALLOWED", correlationId } }, 405);
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return response({ error: { code: "UNAUTHORIZED", correlationId } }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await request.json()) as RequestBody;
    let data: unknown;
    if (body.action === "authorize") data = await handleAuthorize(body, authData.user.id, userClient);
    else if (body.action === "callback") data = await handleCallback(body, authData.user.id, admin);
    else if (body.action === "sync") data = await handleSync(body, userClient, admin);
    else if (body.action === "import") data = await handleImport(body, userClient, admin);
    else if (body.action === "health") {
      if (!body.connectionId) throw new Error("MEETING_REQUEST_INVALID");
      const connection = await loadConnection(admin, body.connectionId);
      await requirePermission(userClient, connection.org_id, "briefing.connections.view");
      await requireTeamsEntitlement(userClient, connection.org_id);
      const token = await connectionToken(admin, connection.id);
      const me = await new TeamsGraphClient(token.access_token).getMe();
      data = { status: "healthy", account: me.displayName };
    } else throw new Error("MEETING_ACTION_INVALID");
    return response({ data, correlationId });
  } catch (error) {
    const graphError = error instanceof TeamsGraphError ? error : null;
    const code = graphError?.code ??
      (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "TEAMS_CONNECTOR_FAILED");
    const status = graphError?.status === 429 ? 429 : graphError?.category === "auth" ? 401 :
      graphError?.category === "permission" || code.includes("ACCESS_DENIED") ? 403 : 400;
    return response({
      error: {
        code,
        message: "Não foi possível concluir a operação do conector Teams.",
        recoverable: graphError?.recoverable ?? false,
        retryAfterSeconds: graphError?.retryAfterSeconds,
        correlationId,
      },
    }, status);
  }
});
