import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = {
  objectives: readFileSync(
    "src/features/okr/pages/OkrObjectivesPage.tsx",
    "utf8",
  ),
  keyResults: readFileSync(
    "src/features/okr/components/OkrKeyResultsDialog.tsx",
    "utf8",
  ),
  initiatives: readFileSync(
    "src/features/okr/components/OkrInitiativesDialog.tsx",
    "utf8",
  ),
  objectiveReview: readFileSync(
    "src/features/okr/components/OkrObjectiveReviewDialog.tsx",
    "utf8",
  ),
  cycleReview: readFileSync(
    "src/features/okr/components/OkrCycleReviewPanel.tsx",
    "utf8",
  ),
};

function expectLabelControlPair(source: string, id: string) {
  expect(source).toContain(`htmlFor="${id}"`);
  expect(source).toContain(`id="${id}"`);
}

describe("OKR V2 form accessibility contract", () => {
  it("associates objective planning labels with their controls", () => {
    expectLabelControlPair(sources.objectives, "okr-objective-cycle");
    expectLabelControlPair(sources.objectives, "okr-objective-title");
    expectLabelControlPair(sources.objectives, "okr-objective-description");
    expectLabelControlPair(sources.objectives, "okr-objective-level");
    expect(sources.objectives).toContain("const { currentTeamId } = useAuth()");
    expect(sources.objectives).toContain(
      "team_id: isTeamObjective ? currentTeamId : null",
    );
  });

  it("associates the primary KR and initiative labels with their controls", () => {
    expectLabelControlPair(sources.keyResults, "okr-kr-title");
    expectLabelControlPair(sources.keyResults, "okr-kr-description");
    expectLabelControlPair(sources.keyResults, "okr-kr-baseline");
    expectLabelControlPair(sources.keyResults, "okr-kr-current");
    expectLabelControlPair(sources.keyResults, "okr-kr-target");
    expectLabelControlPair(sources.initiatives, "okr-initiative-title");
  });

  it("associates objective and cycle review labels with their controls", () => {
    expectLabelControlPair(sources.objectiveReview, "okr-review-outcome-summary");
    expectLabelControlPair(sources.objectiveReview, "okr-review-lessons-learned");
    expectLabelControlPair(sources.cycleReview, "okr-cycle-review-achievements");
    expectLabelControlPair(sources.cycleReview, "okr-cycle-review-lessons");
  });
});
