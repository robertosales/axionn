import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTeamDependentBrowserState,
  TEAM_DEPENDENT_QUERY_PARAMS,
  TEAM_DEPENDENT_SESSION_KEYS,
} from "./teamContextChange";

describe("team context browser reset", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/sala-agil/metricas?memberId=old&sprintId=old&page=3&globalView=compact");
  });

  it("clears persisted team filters and dependent query parameters", () => {
    TEAM_DEPENDENT_SESSION_KEYS.forEach((key) => sessionStorage.setItem(key, "old"));
    clearTeamDependentBrowserState();

    TEAM_DEPENDENT_SESSION_KEYS.forEach((key) => expect(sessionStorage.getItem(key)).toBeNull());
    const params = new URLSearchParams(window.location.search);
    TEAM_DEPENDENT_QUERY_PARAMS.forEach((key) => expect(params.has(key)).toBe(false));
    expect(params.get("globalView")).toBe("compact");
  });
});
