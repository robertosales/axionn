import { describe, expect, it } from "vitest";

import { normalizeEventType } from "./GitlabEventsPanel";

describe("normalizeEventType", () => {
  it("maps GitLab event variants to canonical types", () => {
    expect(normalizeEventType("Merge Request Hook", null)).toBe("merge_request");
    expect(normalizeEventType("push_events", null)).toBe("push");
    expect(normalizeEventType("comment", null)).toBe("note");
    expect(normalizeEventType("deployment_events", null)).toBe("deployment");
    expect(normalizeEventType("job_event", null)).toBe("job");
  });

  it("uses payload values when the row event type is inconsistent", () => {
    expect(normalizeEventType("unknown", { object_kind: "pipeline" })).toBe("pipeline");
    expect(normalizeEventType("unknown", { object_kind: "note" })).toBe("note");
  });
});
