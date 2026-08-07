import { describe, expect, it } from "vitest";

import {
  buildGoogleMeetPocFixture,
  buildTeamsPocFixture,
  type PocMeetingInput,
} from "./pocFixtureBuilder";

const commonInput: PocMeetingInput = {
  externalMeetingId: "provider-meeting-secret-id",
  externalTenantId: "provider-tenant-secret-id",
  externalArtifactId: "provider-artifact-secret-id",
  sourceVersion: "v1",
  startsAt: "2026-07-30T12:00:00.000Z",
  endsAt: "2026-07-30T12:30:00.000Z",
  language: "pt-BR",
  participants: [
    {
      providerId: "provider-user-a",
      providerSpeakerLabel: "Pessoa Real A",
      role: "organizer",
    },
    {
      providerId: "provider-user-b",
      providerSpeakerLabel: "Pessoa Real B",
      role: "attendee",
    },
  ],
};

describe("buildTeamsPocFixture", () => {
  const webVtt = `WEBVTT

cue-provider-1
00:00:01.000 --> 00:00:03.000
<v Pessoa Real A>Conteúdo já sanitizado.</v>`;

  it("pseudonimiza identificadores e speakers do provedor", async () => {
    const fixture = await buildTeamsPocFixture({ ...commonInput, webVtt });
    const serialized = JSON.stringify(fixture);

    expect(fixture.provider).toBe("microsoft_teams");
    expect(fixture.organizer.displayName).toBe("Participante 1");
    expect(fixture.transcript.segments[0].speakerLabel).toBe("Participante 1");
    expect(serialized).not.toContain("provider-meeting-secret-id");
    expect(serialized).not.toContain("provider-user-a");
    expect(serialized).not.toContain("Pessoa Real A");
  });

  it("produz identificadores e hash determinísticos", async () => {
    const first = await buildTeamsPocFixture({ ...commonInput, webVtt });
    const second = await buildTeamsPocFixture({ ...commonInput, webVtt });

    expect(second.externalMeetingId).toBe(first.externalMeetingId);
    expect(second.transcript.contentHash).toBe(first.transcript.contentHash);
    expect(first.transcript.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exige organizador", async () => {
    await expect(
      buildTeamsPocFixture({
        ...commonInput,
        participants: commonInput.participants.map((participant) => ({
          ...participant,
          role: "attendee",
        })),
        webVtt,
      }),
    ).rejects.toThrow("organizador");
  });
});

describe("buildGoogleMeetPocFixture", () => {
  it("converte entries e usa o mesmo contrato sanitizado", async () => {
    const fixture = await buildGoogleMeetPocFixture({
      ...commonInput,
      entries: [
        {
          name: "provider-entry-secret-id",
          participant: "provider-user-b",
          text: "Conteúdo já sanitizado.",
          startTime: "2026-07-30T12:00:01.000Z",
          endTime: "2026-07-30T12:00:03.000Z",
        },
      ],
    });

    const serialized = JSON.stringify(fixture);
    expect(fixture.provider).toBe("google_meet");
    expect(fixture.transcript.segments[0].speakerLabel).toBe("Participante 2");
    expect(serialized).not.toContain("provider-entry-secret-id");
    expect(serialized).not.toContain("provider-user-b");
  });
});
