import { describe, expect, it } from "vitest";
import { analistaMatches, buildAnalistasDedup } from "./analistasDedup";

describe("buildAnalistasDedup", () => {
  it("deduplicates duplicate relationships by user id", () => {
    const result = buildAnalistasDedup(
      ["leidy", "leidy", "roberto"],
      [
        { user_id: "leidy", display_name: "Leidy" },
        { user_id: "roberto", display_name: "Roberto Sales" },
      ],
    );
    expect(result).toEqual([
      { user_id: "leidy", display_name: "Leidy" },
      { user_id: "roberto", display_name: "Roberto Sales" },
    ]);
  });

  it("preserves different users with the same display name", () => {
    const result = buildAnalistasDedup(
      ["user-a", "user-b"],
      [
        { user_id: "user-a", display_name: "Alex" },
        { user_id: "user-b", display_name: "Alex" },
      ],
    );
    expect(result.map((option) => option.user_id)).toEqual(["user-a", "user-b"]);
  });

  it("matches only the selected technical id", () => {
    expect(analistaMatches("user-a", "user-a")).toBe(true);
    expect(analistaMatches("user-a", "user-b")).toBe(false);
    expect(analistaMatches("all", "user-b")).toBe(true);
  });
});
