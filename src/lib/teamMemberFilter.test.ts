import { describe, expect, it } from "vitest";
import { filterActiveDevelopers } from "./teamMemberFilter";

describe("filterActiveDevelopers", () => {
  const rows = [
    { id: "dev-leidy-old", user_id: "user-leidy", name: "Leidy", created_at: "2026-01-01" },
    { id: "dev-leidy", user_id: "user-leidy", name: "Leidy", created_at: "2026-02-01" },
    { id: "dev-roberto", user_id: "user-roberto", name: "Roberto Sales", created_at: "2026-01-01" },
    { id: "dev-other", user_id: "user-other", name: "Outro Time", created_at: "2026-01-01" },
  ];

  it("returns exactly one developer per active team user", () => {
    const result = filterActiveDevelopers(rows, new Set(["user-leidy", "user-roberto"]));
    expect(result.map((row) => row.id)).toEqual(["dev-leidy", "dev-roberto"]);
  });

  it("does not merge different technical users that share a name", () => {
    const sameName = [
      { id: "dev-a", user_id: "user-a", name: "Alex" },
      { id: "dev-b", user_id: "user-b", name: "Alex" },
    ];
    expect(filterActiveDevelopers(sameName, new Set(["user-a", "user-b"]))).toHaveLength(2);
  });

  it("excludes users from another team", () => {
    expect(filterActiveDevelopers(rows, new Set(["user-leidy"])).map((row) => row.user_id))
      .toEqual(["user-leidy"]);
  });
});
