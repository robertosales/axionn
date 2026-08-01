import type { CanonicalMeetingFixture } from "./meetingContract.schema";

export type CanonicalTranscriptSegment =
  CanonicalMeetingFixture["transcript"]["segments"][number];

export interface GoogleMeetTranscriptEntry {
  name: string;
  participant?: string;
  text: string;
  startTime: string;
  endTime: string;
}

export interface TranscriptProjectionSegment extends CanonicalTranscriptSegment {
  textStart: number;
  textEnd: number;
}

export interface TranscriptProjection {
  content: string;
  segments: TranscriptProjectionSegment[];
}

const TIMING_LINE =
  /^(\d{2,}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2,}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})(?:\s+.*)?$/;
const VOICE_TAG = /^<v(?:\.[^\s>]+)*\s+([^>]+)>([\s\S]*)$/i;

function parseVttTimestamp(value: string): number {
  const parts = value.replace(",", ".").split(":");
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length > 0 ? Number(parts.pop()) : 0;

  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1_000);
}

function decodeVttText(value: string): string {
  return value
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTeamsWebVtt(
  content: string,
  participantBySpeaker: Readonly<Record<string, string>> = {},
): CanonicalTranscriptSegment[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const segments: CanonicalTranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0 || lines[0] === "WEBVTT" || lines[0].startsWith("NOTE")) {
      continue;
    }

    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingIndex < 0) continue;

    const timing = lines[timingIndex].match(TIMING_LINE);
    if (!timing) continue;

    const externalSegmentId =
      timingIndex > 0 ? lines[timingIndex - 1] : `vtt-cue-${segments.length}`;
    const rawText = lines.slice(timingIndex + 1).join(" ");
    const voiceMatch = rawText.match(VOICE_TAG);
    const speakerLabel = voiceMatch?.[1]?.trim() || "Speaker não identificado";
    const text = decodeVttText(voiceMatch?.[2] ?? rawText);

    if (!text) continue;

    segments.push({
      externalSegmentId,
      participantExternalId: participantBySpeaker[speakerLabel],
      speakerLabel,
      text,
      startMs: parseVttTimestamp(timing[1]),
      endMs: parseVttTimestamp(timing[2]),
      ordinal: segments.length,
    });
  }

  return segments.sort((left, right) => {
    if (left.startMs !== right.startMs) return left.startMs - right.startMs;
    return left.ordinal - right.ordinal;
  }).map((segment, ordinal) => ({ ...segment, ordinal }));
}

export function normalizeGoogleMeetEntries(
  entries: readonly GoogleMeetTranscriptEntry[],
  meetingStartsAt: string,
  participantLabels: Readonly<Record<string, string>> = {},
): CanonicalTranscriptSegment[] {
  const meetingStartMs = Date.parse(meetingStartsAt);
  if (!Number.isFinite(meetingStartMs)) {
    throw new Error("meetingStartsAt invalido");
  }

  return entries
    .map((entry, sourceOrdinal) => {
      const startMs = Date.parse(entry.startTime) - meetingStartMs;
      const endMs = Date.parse(entry.endTime) - meetingStartMs;

      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        throw new Error(`timestamp invalido na entrada ${entry.name}`);
      }
      if (startMs < 0 || endMs <= startMs) {
        throw new Error(`intervalo invalido na entrada ${entry.name}`);
      }

      return {
        externalSegmentId: entry.name,
        participantExternalId: entry.participant,
        speakerLabel:
          (entry.participant && participantLabels[entry.participant]) ||
          "Speaker não identificado",
        text: entry.text.replace(/\s+/g, " ").trim(),
        startMs,
        endMs,
        ordinal: sourceOrdinal,
      };
    })
    .filter((entry) => entry.text.length > 0)
    .sort((left, right) => {
      if (left.startMs !== right.startMs) return left.startMs - right.startMs;
      return left.ordinal - right.ordinal;
    })
    .map((entry, ordinal) => ({ ...entry, ordinal }));
}

function formatTimestamp(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function projectTranscript(
  segments: readonly CanonicalTranscriptSegment[],
): TranscriptProjection {
  let content = "";
  const projectedSegments: TranscriptProjectionSegment[] = [];

  segments.forEach((segment, ordinal) => {
    const separator = ordinal === 0 ? "" : "\n";
    const line = `[${formatTimestamp(segment.startMs)}] ${segment.speakerLabel}: ${segment.text}`;
    const textStart = content.length + separator.length;
    content += `${separator}${line}`;

    projectedSegments.push({
      ...segment,
      ordinal,
      textStart,
      textEnd: content.length,
    });
  });

  return { content, segments: projectedSegments };
}
