import { describe, expect, it, vi } from "vitest";

import {
  classifyTeamsGraphError,
  TeamsGraphClient,
} from "../../../../supabase/functions/_shared/teams-graph";

describe("classifyTeamsGraphError", () => {
  it("classifica bloqueio de transcrição do tenant", () => {
    const error = classifyTeamsGraphError(403, {
      error: { code: "Forbidden", innerError: { code: "GraphAccessToTranscriptsDisabled" } },
    });
    expect(error.code).toBe("TEAMS_TRANSCRIPT_ACCESS_DISABLED");
    expect(error.recoverable).toBe(false);
  });

  it("preserva Retry-After em throttling", () => {
    const error = classifyTeamsGraphError(429, {}, "45");
    expect(error.code).toBe("TEAMS_RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(45);
    expect(error.recoverable).toBe(true);
  });
});

describe("TeamsGraphClient", () => {
  it("pagina calendarView e mantém apenas eventos Teams", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "event-1",
                isOnlineMeeting: true,
                onlineMeetingProvider: "teamsForBusiness",
                onlineMeeting: { joinUrl: "https://teams.microsoft.com/meeting-1" },
                start: { dateTime: "2026-07-30T12:00:00Z" },
                end: { dateTime: "2026-07-30T12:30:00Z" },
              },
            ],
            "@odata.nextLink": "https://graph.microsoft.com/page-2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "event-2",
                isOnlineMeeting: false,
                start: { dateTime: "2026-07-30T13:00:00Z" },
                end: { dateTime: "2026-07-30T13:30:00Z" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const client = new TeamsGraphClient("token", fetcher);
    const events = await client.listCalendarEvents(
      "2026-07-01T00:00:00Z",
      "2026-08-01T00:00:00Z",
    );

    expect(events.map((event) => event.id)).toEqual(["event-1"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("não expõe a mensagem bruta retornada pelo Graph", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "Forbidden", message: "sensitive provider detail" } }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new TeamsGraphClient("token", fetcher);

    await expect(client.getMe()).rejects.toMatchObject({
      code: "TEAMS_PERMISSION_INSUFFICIENT",
      message: "TEAMS_PERMISSION_INSUFFICIENT",
    });
  });
});
