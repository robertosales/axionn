import type { CanonicalMeetingFixture } from "./meetingContract.schema";

const participants = [
  {
    externalId: "participant-organizer",
    displayName: "Participante A",
    role: "organizer" as const,
    attendedIntervals: [
      {
        joinedAt: "2026-07-30T12:00:00.000Z",
        leftAt: "2026-07-30T12:30:00.000Z",
      },
    ],
  },
  {
    externalId: "participant-attendee",
    displayName: "Participante B",
    role: "attendee" as const,
    attendedIntervals: [
      {
        joinedAt: "2026-07-30T12:00:05.000Z",
        leftAt: "2026-07-30T12:29:50.000Z",
      },
    ],
  },
];

const transcriptSegments = [
  {
    externalSegmentId: "segment-000",
    participantExternalId: "participant-organizer",
    speakerLabel: "Participante A",
    text: "Vamos validar o contrato comum dos conectores.",
    startMs: 1_200,
    endMs: 4_900,
    ordinal: 0,
  },
  {
    externalSegmentId: "segment-001",
    participantExternalId: "participant-attendee",
    speakerLabel: "Participante B",
    text: "A evidência deve preservar o speaker e o timestamp.",
    startMs: 5_100,
    endMs: 9_400,
    ordinal: 1,
  },
];

export const teamsMeetingFixture: CanonicalMeetingFixture = {
  schemaVersion: "1.0",
  provider: "microsoft_teams",
  externalMeetingId: "teams-meeting-sanitized-001",
  externalTenantId: "teams-tenant-sanitized",
  subject: "Prova técnica sanitizada",
  organizer: {
    externalId: participants[0].externalId,
    displayName: participants[0].displayName,
    role: participants[0].role,
  },
  startsAt: "2026-07-30T12:00:00.000Z",
  endsAt: "2026-07-30T12:30:00.000Z",
  recordingReferenceUrl: "https://teams.microsoft.com/l/meeting-reference/sanitized",
  status: "ready",
  sourceVersion: "teams-transcript-v1",
  participants,
  transcript: {
    externalArtifactId: "teams-transcript-sanitized-001",
    sourceVersion: "teams-transcript-v1",
    language: "pt-BR",
    contentHash: "a".repeat(64),
    segments: transcriptSegments,
  },
};

export const meetMeetingFixture: CanonicalMeetingFixture = {
  ...teamsMeetingFixture,
  provider: "google_meet",
  externalMeetingId: "meet-conference-record-sanitized-001",
  externalTenantId: "google-workspace-sanitized",
  recordingReferenceUrl: "https://meet.google.com/recording-reference/sanitized",
  sourceVersion: "meet-transcript-v1",
  transcript: {
    ...teamsMeetingFixture.transcript,
    externalArtifactId: "meet-transcript-sanitized-001",
    sourceVersion: "meet-transcript-v1",
    contentHash: "b".repeat(64),
  },
};
