import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260804180000_backlog_features.sql"),
  "utf8",
);
const kanbanBoard = readFileSync(resolve(process.cwd(), "src/components/KanbanBoard.tsx"), "utf8");
const kanbanCard = readFileSync(resolve(process.cwd(), "src/components/KanbanCard.tsx"), "utf8");
const epicManager = readFileSync(resolve(process.cwd(), "src/components/EpicManager.tsx"), "utf8");
const backlogReport = readFileSync(resolve(process.cwd(), "src/components/sala-agil/reports/RelatorioBacklog.tsx"), "utf8");
const preview = readFileSync(resolve(process.cwd(), "src/components/HUPreviewSheet.tsx"), "utf8");
const hardening = readFileSync(resolve(process.cwd(), "supabase/migrations/20260804190000_backlog_features_hardening.sql"), "utf8");

describe("backlog feature hierarchy contract", () => {
  it("keeps commercial and backlog features as separate concepts", () => {
    expect(migration).toContain("create table if not exists public.backlog_features");
    expect(migration).not.toContain("create table if not exists public.product_features");
  });

  it("links stories to features without removing the transitional epic link", () => {
    expect(migration).toContain("add column if not exists feature_id");
    expect(migration).toContain("references public.backlog_features(id) on delete set null");
    expect(migration).not.toContain("drop column epic_id");
  });

  it("enforces tenant and epic consistency and synchronizes feature moves", () => {
    expect(migration).toContain("user_story_feature_team_mismatch");
    expect(migration).toContain("user_story_feature_epic_mismatch");
    expect(migration).toContain("sync_backlog_feature_epic_to_stories");
    expect(migration).toContain("where feature_id = new.id");
  });

  it("enables RLS with team-scoped policies", () => {
    expect(migration).toContain("alter table public.backlog_features enable row level security");
    expect(migration).toContain("public.can_view_team(auth.uid(), team_id)");
    expect(migration).toContain("public.is_team_manager(auth.uid(), team_id)");
  });

  it("exposes feature filtering and identity in the kanban", () => {
    expect(kanbanBoard).toContain('h.featureId === filtros.featureId');
    expect(kanbanCard).toContain("FeatureBadge");
  });

  it("renders the epic-feature-story hierarchy and exports it in backlog reports", () => {
    expect(epicManager).toContain("epicFeatures.map");
    expect(epicManager).toContain("featureHUs.map");
    expect(backlogReport).toContain('header: "Feature"');
    expect(backlogReport).toContain("Feature: r.feature");
  });

  it("shows feature identity in story lists and previews", () => {
    expect(preview).toContain('label="Feature"');
    expect(preview).toContain("hu.featureId");
  });

  it("enforces linked-feature deletion and protects internal trigger functions", () => {
    expect(hardening).toContain("backlog_feature_has_user_stories");
    expect(hardening).toContain("prevent_linked_backlog_feature_delete");
    expect(hardening).toContain("revoke all on function public.validate_backlog_hierarchy()");
  });
});
