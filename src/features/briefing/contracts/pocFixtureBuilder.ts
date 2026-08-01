import {
  canonicalMeetingFixtureSchema,
  type CanonicalMeetingFixture,
} from "./meetingContract.schema";
import {
  normalizeGoogleMeetEntries,
  parseTeamsWebVtt,
  projectTranscript,
  type CanonicalTranscriptSegment,
  type GoogleMeetTranscriptEntry,
} from "./transcriptNormalizer";

type ParticipantRole =
  CanonicalMeetingFixture["participants"][number]["role"];

export interface PocParticipantInput {
  providerId: string;
  providerSpeakerLabel?: string;
  role: ParticipantRole;
  attendedIntervals?: Array<{
    joinedAt: string;
    leftAt?: string;
  }>;
}

export interface PocMeetingInput {
  externalMeetingId: string;
  externalTenantId?: string;
  externalArtifactId: string;
  sourceVersion: string;
  startsAt: string;
  endsAt?: string;
  language: string;
  participants: PocParticipantInput[];
}

export interface TeamsPocInput extends PocMeetingInput {
  webVtt: string;
}

export interface GoogleMeetPocInput extends PocMeetingInput {
  entries: GoogleMeetTranscriptEntry[];
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function pseudonymousId(prefix: string, value: string): Promise<string> {
  return `${prefix}-${(await sha256(value)).slice(0, 16)}`;
}

async function sanitizeParticipants(participants: PocParticipantInput[]) {
  return Promise.all(
    participants.map(async (participant, index) => ({
      externalId: await pseudonymousId("participant", participant.providerId),
      displayName: `Participante ${index + 1}`,
      role: participant.role,
      attendedIntervals: participant.attendedIntervals ?? [],
    })),
  );
}

async function sanitizeSegments(
  segments: CanonicalTranscriptSegment[],
  participantIdMap: ReadonlyMap<string, string>,
): Promise<CanonicalTranscriptSegment[]> {
  return Promise.all(
    segments.map(async (segment, ordinal) => {
      const participantExternalId = segment.participantExternalId
        ? participantIdMap.get(segment.participantExternalId)
        : undefined;

      return {
        ...segment,
        externalSegmentId: await pseudonymousId(
          "segment",
          segment.externalSegmentId,
        ),
        participantExternalId,
        speakerLabel: participantExternalId
          ? `Participante ${
              Array.from(participantIdMap.values()).indexOf(participantExternalId) + 1
            }`
          : "Speaker não identificado",
        ordinal,
      };
    }),
  );
}

async function buildFixture(
  provider: "microsoft_teams" | "google_meet",
  input: PocMeetingInput,
  rawSegments: CanonicalTranscriptSegment[],
): Promise<CanonicalMeetingFixture> {
  if (rawSegments.length === 0) {
    throw new Error("a transcrição precisa conter ao menos um segmento");
  }

  const participants = await sanitizeParticipants(input.participants);
  const participantIdMap = new Map(
    input.participants.map((participant, index) => [
      participant.providerId,
      participants[index].externalId,
    ]),
  );
  const segments = await sanitizeSegments(rawSegments, participantIdMap);
  const projection = projectTranscript(segments);
  const organizer = participants.find(
    (participant) => participant.role === "organizer",
  );

  if (!organizer) {
    throw new Error("a reunião precisa de um organizador");
  }

  return canonicalMeetingFixtureSchema.parse({
    schemaVersion: "1.0",
    provider,
    externalMeetingId: await pseudonymousId(
      `${provider}-meeting`,
      input.externalMeetingId,
    ),
    externalTenantId: input.externalTenantId
      ? await pseudonymousId(`${provider}-tenant`, input.externalTenantId)
      : undefined,
    subject: "Reunião sanitizada da prova técnica",
    organizer: {
      externalId: organizer.externalId,
      displayName: organizer.displayName,
      role: organizer.role,
    },
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: "ready",
    sourceVersion: input.sourceVersion,
    participants,
    transcript: {
      externalArtifactId: await pseudonymousId(
        `${provider}-transcript`,
        input.externalArtifactId,
      ),
      sourceVersion: input.sourceVersion,
      language: input.language,
      contentHash: await sha256(projection.content),
      segments,
    },
  });
}

export async function buildTeamsPocFixture(
  input: TeamsPocInput,
): Promise<CanonicalMeetingFixture> {
  const participantBySpeaker = Object.fromEntries(
    input.participants
      .filter((participant) => participant.providerSpeakerLabel)
      .map((participant) => [
        participant.providerSpeakerLabel!,
        participant.providerId,
      ]),
  );
  const segments = parseTeamsWebVtt(input.webVtt, participantBySpeaker);
  return buildFixture("microsoft_teams", input, segments);
}

export async function buildGoogleMeetPocFixture(
  input: GoogleMeetPocInput,
): Promise<CanonicalMeetingFixture> {
  const participantLabels = Object.fromEntries(
    input.participants.map((participant, index) => [
      participant.providerId,
      `Participante ${index + 1}`,
    ]),
  );
  const segments = normalizeGoogleMeetEntries(
    input.entries,
    input.startsAt,
    participantLabels,
  );
  return buildFixture("google_meet", input, segments);
}
