import { describe, expect, it } from "vitest";

import {
  meetMeetingFixture,
  teamsMeetingFixture,
} from "./meetingContract.fixtures";
import { canonicalMeetingFixtureSchema } from "./meetingContract.schema";

describe("canonicalMeetingFixtureSchema", () => {
  it.each([
    ["Microsoft Teams", teamsMeetingFixture],
    ["Google Meet", meetMeetingFixture],
  ])("valida fixture sanitizado de %s", (_provider, fixture) => {
    expect(canonicalMeetingFixtureSchema.parse(fixture)).toEqual(fixture);
  });

  it("rejeita intervalo temporal invertido", () => {
    const result = canonicalMeetingFixtureSchema.safeParse({
      ...teamsMeetingFixture,
      transcript: {
        ...teamsMeetingFixture.transcript,
        segments: [
          {
            ...teamsMeetingFixture.transcript.segments[0],
            startMs: 5_000,
            endMs: 4_000,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejeita segmentos fora de ordem", () => {
    const result = canonicalMeetingFixtureSchema.safeParse({
      ...teamsMeetingFixture,
      transcript: {
        ...teamsMeetingFixture.transcript,
        segments: [
          teamsMeetingFixture.transcript.segments[1],
          teamsMeetingFixture.transcript.segments[0],
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejeita referência a participante inexistente", () => {
    const result = canonicalMeetingFixtureSchema.safeParse({
      ...teamsMeetingFixture,
      transcript: {
        ...teamsMeetingFixture.transcript,
        segments: [
          {
            ...teamsMeetingFixture.transcript.segments[0],
            participantExternalId: "participant-missing",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it.each(["access_token", "authorization", "sig", "token"])(
    "rejeita URL de gravação com parâmetro sensível %s",
    (parameter) => {
      const result = canonicalMeetingFixtureSchema.safeParse({
        ...teamsMeetingFixture,
        recordingReferenceUrl: `https://example.test/recording?${parameter}=secret`,
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejeita hash de conteúdo fora do formato SHA-256", () => {
    const result = canonicalMeetingFixtureSchema.safeParse({
      ...meetMeetingFixture,
      transcript: {
        ...meetMeetingFixture.transcript,
        contentHash: "not-a-sha256",
      },
    });

    expect(result.success).toBe(false);
  });
});
