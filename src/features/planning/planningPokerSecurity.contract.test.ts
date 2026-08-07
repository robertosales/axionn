import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260807110000_planning_poker_vote_hardening.sql",
  "utf8",
);
const hook = readFileSync("src/features/planning/hooks/usePlanningPoker.ts", "utf8");
const lifecycleMigration = readFileSync(
  "supabase/migrations/20260807120000_planning_poker_lifecycle_hardening.sql",
  "utf8",
);

describe("Planning Poker secret ballot contract", () => {
  it("removes direct client access to votes and exposes only controlled RPCs", () => {
    expect(migration).toContain("revoke all on public.planning_votes from anon, public, authenticated");
    expect(migration).toContain("get_planning_round_votes");
    expect(migration).toContain("cast_planning_vote");
    expect(migration).toContain("reveal_planning_votes");
  });

  it("masks other users' values until the round is revealed", () => {
    expect(migration).toContain("or vote.user_id = auth.uid() then vote.vote_value else null");
    expect(migration).toContain("round.status in ('revealed', 'saved')");
  });

  it("binds one atomic vote to the authenticated user", () => {
    expect(migration).toContain("planning_votes_one_per_user_round");
    expect(migration).toContain("values (p_session_id, p_hu_id, auth.uid()");
    expect(migration).toContain("on conflict (session_id, hu_id, user_id)");
    expect(migration).toContain("set vote_revision = vote_revision + 1");
  });

  it("allows only the facilitator or an administrator to reveal", () => {
    expect(migration).toContain("auth.uid() <> v_creator");
    expect(migration).toContain("planning_facilitator_required");
  });

  it("does not query or mutate planning_votes directly from the hook", () => {
    expect(hook).not.toContain('.from("planning_votes")');
    expect(hook).not.toContain('table: "planning_votes"');
    expect(hook).not.toContain('v.user_id === ""');
    expect(hook).toContain('supabase.rpc("get_planning_round_votes"');
    expect(hook).toContain('supabase.rpc("cast_planning_vote"');
    expect(hook).toContain('supabase.rpc("reveal_planning_votes"');
  });

  it("moves lifecycle mutations behind facilitator-owned RPCs", () => {
    expect(lifecycleMigration).toContain("revoke insert, update, delete on public.planning_sessions");
    expect(lifecycleMigration).toContain("revoke insert, update, delete on public.planning_rounds");
    expect(lifecycleMigration).toContain("create_planning_session");
    expect(lifecycleMigration).toContain("start_planning_round");
    expect(lifecycleMigration).toContain("save_planning_result");
    expect(lifecycleMigration).toContain("close_planning_session");
    expect(lifecycleMigration).toContain("planning_facilitator_required");
    expect(hook).not.toContain('.from("planning_sessions").insert');
    expect(hook).not.toContain('.from("planning_rounds").insert');
    expect(hook).not.toContain('.from("planning_rounds").update');
  });
});
