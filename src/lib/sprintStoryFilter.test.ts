import { describe, expect, it } from "vitest";
import { filterStoriesBySprint, resolveBacklogSprintId } from "./sprintStoryFilter";

const stories = [
  { id: "active", sprintId: "sprint-active" },
  { id: "closed", sprintId: "sprint-closed" },
  { id: "backlog", sprintId: null },
];

describe("backlog sprint selection", () => {
  it("falls back to the active sprint when none was selected", () => {
    expect(resolveBacklogSprintId(null, "sprint-active")).toBe("sprint-active");
  });

  it("prioritizes an explicitly selected sprint", () => {
    expect(resolveBacklogSprintId("sprint-closed", "sprint-active")).toBe("sprint-closed");
  });

  it("returns only stories from the selected sprint", () => {
    expect(filterStoriesBySprint(stories, "sprint-active").map((story) => story.id)).toEqual(["active"]);
    expect(filterStoriesBySprint(stories, "sprint-closed").map((story) => story.id)).toEqual(["closed"]);
  });
});

