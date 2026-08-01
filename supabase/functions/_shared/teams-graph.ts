export const TEAMS_DELEGATED_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Calendars.ReadBasic",
  "OnlineMeetings.Read",
  "OnlineMeetingTranscript.Read.All",
] as const;

export type GraphErrorCategory =
  | "auth"
  | "permission"
  | "rate_limit"
  | "not_found"
  | "artifact_pending"
  | "validation"
  | "provider";

export class TeamsGraphError extends Error {
  constructor(
    public readonly category: GraphErrorCategory,
    public readonly code: string,
    public readonly status: number,
    public readonly recoverable: boolean,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "TeamsGraphError";
  }
}

export interface GraphPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export interface TeamsCalendarEvent {
  id: string;
  subject?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: { joinUrl?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
}

export interface TeamsOnlineMeeting {
  id: string;
  subject?: string;
  startDateTime: string;
  endDateTime?: string;
  joinWebUrl?: string;
  participants?: {
    organizer?: { identity?: { user?: { id?: string; displayName?: string } } };
    attendees?: Array<{
      identity?: { user?: { id?: string; displayName?: string } };
      role?: string;
    }>;
  };
}

export interface TeamsCallTranscript {
  id: string;
  createdDateTime?: string;
  endDateTime?: string;
  transcriptContentUrl?: string;
  contentCorrelationId?: string;
}

type FetchLike = typeof fetch;

function nestedProviderCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const value = error as {
    code?: string;
    innerError?: { code?: string };
    innererror?: { code?: string };
  };
  return value.innerError?.code ?? value.innererror?.code ?? value.code;
}

export function classifyTeamsGraphError(
  status: number,
  payload: unknown,
  retryAfter?: string | null,
): TeamsGraphError {
  const providerCode = nestedProviderCode(payload);
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : undefined;

  if (status === 401) {
    return new TeamsGraphError("auth", "TEAMS_TOKEN_INVALID", status, true);
  }
  if (providerCode === "GraphAccessToTranscriptsDisabled") {
    return new TeamsGraphError(
      "permission",
      "TEAMS_TRANSCRIPT_ACCESS_DISABLED",
      status,
      false,
    );
  }
  if (providerCode === "SpeakerAttributionNotAllowed") {
    return new TeamsGraphError(
      "permission",
      "TEAMS_SPEAKER_ATTRIBUTION_DISABLED",
      status,
      false,
    );
  }
  if (status === 403) {
    return new TeamsGraphError(
      "permission",
      "TEAMS_PERMISSION_INSUFFICIENT",
      status,
      false,
    );
  }
  if (status === 404) {
    return new TeamsGraphError("not_found", "TEAMS_RESOURCE_NOT_FOUND", status, false);
  }
  if (status === 429) {
    return new TeamsGraphError(
      "rate_limit",
      "TEAMS_RATE_LIMITED",
      status,
      true,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
  }
  if (status >= 500) {
    return new TeamsGraphError("provider", "TEAMS_PROVIDER_UNAVAILABLE", status, true);
  }
  return new TeamsGraphError("provider", "TEAMS_GRAPH_REQUEST_FAILED", status, false);
}

export class TeamsGraphClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  private async request<T>(url: string, accept = "application/json"): Promise<T> {
    const response = await this.fetcher(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: accept,
        "client-request-id": crypto.randomUUID(),
      },
    });
    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }
      throw classifyTeamsGraphError(
        response.status,
        payload,
        response.headers.get("Retry-After"),
      );
    }
    if (accept === "text/vtt" || accept.includes("transcript+text")) {
      return (await response.text()) as T;
    }
    return (await response.json()) as T;
  }

  async getMe(): Promise<{ id: string; displayName: string; userPrincipalName?: string }> {
    return this.request("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName");
  }

  async listCalendarEvents(start: string, end: string, maxItems = 50) {
    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    url.searchParams.set("startDateTime", start);
    url.searchParams.set("endDateTime", end);
    url.searchParams.set(
      "$select",
      "id,subject,start,end,isOnlineMeeting,onlineMeetingProvider,onlineMeeting,organizer",
    );
    url.searchParams.set("$top", String(Math.min(maxItems, 100)));

    const events: TeamsCalendarEvent[] = [];
    let nextUrl: string | undefined = url.toString();
    while (nextUrl && events.length < maxItems) {
      const page: GraphPage<TeamsCalendarEvent> = await this.request(nextUrl);
      events.push(...page.value);
      nextUrl = page["@odata.nextLink"];
    }
    return events
      .filter(
        (event) =>
          event.isOnlineMeeting &&
          event.onlineMeetingProvider === "teamsForBusiness" &&
          event.onlineMeeting?.joinUrl,
      )
      .slice(0, maxItems);
  }

  async resolveOnlineMeeting(joinWebUrl: string): Promise<TeamsOnlineMeeting | null> {
    const escaped = joinWebUrl.replaceAll("'", "''");
    const url = new URL("https://graph.microsoft.com/v1.0/me/onlineMeetings");
    url.searchParams.set("$filter", `JoinWebUrl eq '${escaped}'`);
    const page = await this.request<GraphPage<TeamsOnlineMeeting>>(url.toString());
    return page.value[0] ?? null;
  }

  async listTranscripts(meetingId: string): Promise<TeamsCallTranscript[]> {
    const encodedMeetingId = encodeURIComponent(meetingId);
    const transcripts: TeamsCallTranscript[] = [];
    let nextUrl: string | undefined =
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${encodedMeetingId}/transcripts`;
    while (nextUrl && transcripts.length < 100) {
      const page: GraphPage<TeamsCallTranscript> = await this.request(nextUrl);
      transcripts.push(...page.value);
      nextUrl = page["@odata.nextLink"];
    }
    return transcripts.slice(0, 100);
  }

  async getTranscriptWebVtt(meetingId: string, transcriptId: string): Promise<string> {
    return this.request(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(transcriptId)}/content`,
      "text/vtt",
    );
  }
}
