import { z } from "zod";

export const MEETING_PROVIDERS = [
  "microsoft_teams",
  "google_meet",
  "manual",
] as const;

const externalIdSchema = z.string().trim().min(1).max(500);
const isoDateSchema = z.string().datetime({ offset: true });
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "hash SHA-256 invalido");

const safeProviderUrlSchema = z
  .string()
  .url()
  .max(2_048)
  .superRefine((value, context) => {
    const url = new URL(value);
    const forbiddenParameters = [
      "access_token",
      "authorization",
      "code",
      "sig",
      "signature",
      "token",
    ];

    for (const parameter of forbiddenParameters) {
      if (url.searchParams.has(parameter)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `URL contem parametro sensivel: ${parameter}`,
        });
      }
    }
  });

export const canonicalIdentitySchema = z.object({
  externalId: externalIdSchema,
  displayName: z.string().trim().min(1).max(240),
  role: z.enum(["organizer", "presenter", "attendee", "unknown"]),
});

export const canonicalParticipantSchema = canonicalIdentitySchema.extend({
  attendedIntervals: z
    .array(
      z
        .object({
          joinedAt: isoDateSchema,
          leftAt: isoDateSchema.optional(),
        })
        .superRefine((interval, context) => {
          if (
            interval.leftAt &&
            Date.parse(interval.leftAt) <= Date.parse(interval.joinedAt)
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "leftAt deve ser posterior a joinedAt",
              path: ["leftAt"],
            });
          }
        }),
    )
    .max(100)
    .default([]),
});

export const canonicalTranscriptSegmentSchema = z
  .object({
    externalSegmentId: externalIdSchema,
    participantExternalId: externalIdSchema.optional(),
    speakerLabel: z.string().trim().min(1).max(240),
    text: z.string().trim().min(1).max(20_000),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    ordinal: z.number().int().nonnegative(),
  })
  .superRefine((segment, context) => {
    if (segment.endMs <= segment.startMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endMs deve ser maior que startMs",
        path: ["endMs"],
      });
    }
  });

export const canonicalTranscriptSchema = z
  .object({
    externalArtifactId: externalIdSchema,
    sourceVersion: z.string().trim().min(1).max(200),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    contentHash: sha256Schema,
    segments: z.array(canonicalTranscriptSegmentSchema).min(1).max(100_000),
  })
  .superRefine((transcript, context) => {
    const segmentIds = new Set<string>();

    transcript.segments.forEach((segment, index) => {
      if (segment.ordinal !== index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ordinais devem ser contiguos e iniciar em zero",
          path: ["segments", index, "ordinal"],
        });
      }

      if (index > 0 && segment.startMs < transcript.segments[index - 1].startMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "segmentos devem estar ordenados por startMs",
          path: ["segments", index, "startMs"],
        });
      }

      if (segmentIds.has(segment.externalSegmentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "externalSegmentId duplicado",
          path: ["segments", index, "externalSegmentId"],
        });
      }
      segmentIds.add(segment.externalSegmentId);
    });
  });

export const canonicalMeetingFixtureSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    provider: z.enum(MEETING_PROVIDERS),
    externalMeetingId: externalIdSchema,
    externalTenantId: externalIdSchema.optional(),
    subject: z.string().trim().min(1).max(500),
    organizer: canonicalIdentitySchema,
    startsAt: isoDateSchema,
    endsAt: isoDateSchema.optional(),
    recordingReferenceUrl: safeProviderUrlSchema.optional(),
    status: z.enum(["discovered", "artifacts_pending", "ready"]),
    sourceVersion: z.string().trim().min(1).max(200),
    participants: z.array(canonicalParticipantSchema).min(1).max(5_000),
    transcript: canonicalTranscriptSchema,
  })
  .superRefine((meeting, context) => {
    if (meeting.endsAt && Date.parse(meeting.endsAt) <= Date.parse(meeting.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endsAt deve ser posterior a startsAt",
        path: ["endsAt"],
      });
    }

    const participantIds = new Set(
      meeting.participants.map((participant) => participant.externalId),
    );

    meeting.transcript.segments.forEach((segment, index) => {
      if (
        segment.participantExternalId &&
        !participantIds.has(segment.participantExternalId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "segmento referencia participante inexistente",
          path: ["transcript", "segments", index, "participantExternalId"],
        });
      }
    });
  });

export type CanonicalMeetingFixture = z.infer<
  typeof canonicalMeetingFixtureSchema
>;

export function parseCanonicalMeetingFixture(
  input: unknown,
): CanonicalMeetingFixture {
  return canonicalMeetingFixtureSchema.parse(input);
}
