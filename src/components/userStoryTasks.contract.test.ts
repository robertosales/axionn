import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Backlog task management contract", () => {
  const managerSource = fs.readFileSync(path.resolve("src/components/UserStoryManager.tsx"), "utf8");
  const contextSource = fs.readFileSync(path.resolve("src/contexts/SprintContext.tsx"), "utf8");

  it("keeps tasks collapsed by default and exposes completed/total counts", () => {
    expect(managerSource).toContain("useState<Record<string, boolean>>({})");
    expect(managerSource).toContain("aria-expanded={!!expandedTaskHUs[hu.id]}");
    expect(managerSource).toContain('{closedAct.length}/{huActivities.length} {huActivities.length === 1 ? "tarefa" : "tarefas"}');
    expect(managerSource).toContain("0 tarefas");
    expect(managerSource).toContain("huActivities.length > 0 ? (");
  });

  it("shows task title, current status and assignee in the expanded HU layer", () => {
    expect(managerSource).toContain("{task.title}");
    expect(managerSource).toContain('task.isClosed ? "Concluída" : "Aberta"');
    expect(managerSource).toContain('taskAssignee?.name ?? "Sem responsável"');
  });

  it("uses the same activity entity for the Backlog and the central Tasks view", () => {
    expect(managerSource).toContain("<QuickActivityDialog");
    expect(managerSource).toContain("<TaskDetailSheet");
    expect(contextSource).toContain('supabase.from("activities").select("*").eq("team_id", teamId).limit(500)');
    expect(contextSource).toContain('team_id: teamId, hu_id: act.huId');
  });
});
