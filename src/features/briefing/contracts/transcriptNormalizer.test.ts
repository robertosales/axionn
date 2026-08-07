import { describe, expect, it } from "vitest";

import {
  normalizeGoogleMeetEntries,
  parseTeamsWebVtt,
  projectTranscript,
} from "./transcriptNormalizer";

describe("parseTeamsWebVtt", () => {
  it("preserva speaker, participante e timestamps", () => {
    const segments = parseTeamsWebVtt(
      `WEBVTT

cue-1
00:00:01.200 --> 00:00:04.900
<v Participante A>Vamos validar o contrato.</v>

cue-2
00:00:05.100 --> 00:00:09.400 position:50%
<v Participante B>A evidência terá timestamp.</v>`,
      {
        "Participante A": "participant-a",
        "Participante B": "participant-b",
      },
    );

    expect(segments).toEqual([
      {
        externalSegmentId: "cue-1",
        participantExternalId: "participant-a",
        speakerLabel: "Participante A",
        text: "Vamos validar o contrato.",
        startMs: 1_200,
        endMs: 4_900,
        ordinal: 0,
      },
      {
        externalSegmentId: "cue-2",
        participantExternalId: "participant-b",
        speakerLabel: "Participante B",
        text: "A evidência terá timestamp.",
        startMs: 5_100,
        endMs: 9_400,
        ordinal: 1,
      },
    ]);
  });

  it("ignora metadados, notas e cues sem texto", () => {
    const segments = parseTeamsWebVtt(`WEBVTT
Kind: captions

NOTE conteúdo sanitizado

00:01.000 --> 00:02.000
<v Speaker A></v>`);

    expect(segments).toEqual([]);
  });
});

describe("normalizeGoogleMeetEntries", () => {
  it("converte timestamps absolutos em milissegundos relativos", () => {
    const segments = normalizeGoogleMeetEntries(
      [
        {
          name: "transcripts/t1/entries/e1",
          participant: "conferenceRecords/c1/participants/p1",
          text: "  Texto   normalizado. ",
          startTime: "2026-07-30T12:00:05.100Z",
          endTime: "2026-07-30T12:00:09.400Z",
        },
      ],
      "2026-07-30T12:00:00.000Z",
      { "conferenceRecords/c1/participants/p1": "Participante B" },
    );

    expect(segments[0]).toMatchObject({
      externalSegmentId: "transcripts/t1/entries/e1",
      participantExternalId: "conferenceRecords/c1/participants/p1",
      speakerLabel: "Participante B",
      text: "Texto normalizado.",
      startMs: 5_100,
      endMs: 9_400,
      ordinal: 0,
    });
  });

  it("rejeita timestamp anterior ao início da reunião", () => {
    expect(() =>
      normalizeGoogleMeetEntries(
        [
          {
            name: "entry-invalid",
            text: "Inválido",
            startTime: "2026-07-30T11:59:59.000Z",
            endTime: "2026-07-30T12:00:01.000Z",
          },
        ],
        "2026-07-30T12:00:00.000Z",
      ),
    ).toThrow("intervalo invalido");
  });
});

describe("projectTranscript", () => {
  it("gera conteúdo e offsets determinísticos", () => {
    const segments = parseTeamsWebVtt(`WEBVTT

cue-1
00:00:01.200 --> 00:00:04.900
<v Participante A>Primeira fala.</v>

cue-2
00:00:05.100 --> 00:00:09.400
<v Participante B>Segunda fala.</v>`);

    const projection = projectTranscript(segments);

    expect(projection.content).toBe(
      "[00:00:01] Participante A: Primeira fala.\n" +
        "[00:00:05] Participante B: Segunda fala.",
    );
    for (const segment of projection.segments) {
      expect(
        projection.content.slice(segment.textStart, segment.textEnd),
      ).toContain(segment.text);
    }
  });
});
