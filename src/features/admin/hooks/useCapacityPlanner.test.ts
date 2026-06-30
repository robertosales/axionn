import { describe, expect, it } from "vitest";
import { buildCapacityModel } from "./useCapacityPlanner";

const teams = [{ id: "team-a", name: "[GESP3] - TIME A", module: "sala_agil" }];
const developers = [{
  id: "dev-1",
  name: "Ana",
  team_id: "team-a",
  user_id: "user-1",
}];

const activeSprint = [{
  id: "sprint-1",
  name: "Sprint 1",
  team_id: "team-a",
  start_date: "2026-06-20",
  end_date: "2026-07-03",
}];

describe("buildCapacityModel", () => {
  it("usa developers como roster e relaciona HUs por assignee_id do desenvolvedor", () => {
    const result = buildCapacityModel({
      teams,
      developers,
      sprints: activeSprint,
      stories: [{
        id: "hu-1",
        title: "Implementar relatório",
        estimated_hours: 20,
        story_points: 5,
        status: "em_andamento",
        team_id: "team-a",
        sprint_id: "sprint-1",
        assignee_id: "dev-1",
      }],
      activities: [{
        id: "activity-1",
        hu_id: "hu-1",
        assignee_id: "dev-1",
        hours: 6,
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].devs).toHaveLength(1);
    expect(result[0].devs[0]).toMatchObject({
      devId: "dev-1",
      userId: "user-1",
      capacityHours: 40,
      allocatedHours: 20,
      realizedHours: 6,
      utilizationPct: 50,
      wipCount: 1,
      status: "ok",
    });
    expect(result[0]).toMatchObject({
      sprintAtivo: "Sprint 1",
      totalCapacity: 40,
      totalAllocated: 20,
      totalRealized: 6,
      utilizationPct: 50,
    });
  });

  it("aplica declaração somente ao usuário, time e sprint correspondentes", () => {
    const result = buildCapacityModel({
      teams,
      developers,
      sprints: activeSprint,
      stories: [],
      activities: [],
      declarations: [
        { user_id: "user-1", team_id: "team-a", sprint_id: "sprint-1", declared_hours: 32 },
        { user_id: "user-1", team_id: "team-a", sprint_id: "sprint-old", declared_hours: 80 },
      ],
    });

    expect(result[0].devs[0].capacityHours).toBe(32);
    expect(result[0].totalCapacity).toBe(32);
  });

  it("mantém o desenvolvedor visível mesmo quando o time não possui sprint ativa", () => {
    const result = buildCapacityModel({
      teams,
      developers,
      sprints: [],
      stories: [],
      activities: [],
    });

    expect(result[0].devs).toHaveLength(1);
    expect(result[0].devs[0]).toMatchObject({
      noActiveSprint: true,
      status: "unknown",
      capacityHours: 40,
    });
    expect(result[0].sprintAtivo).toBeNull();
  });

  it("não considera como WIP itens concluídos ou cancelados", () => {
    const result = buildCapacityModel({
      teams,
      developers,
      sprints: activeSprint,
      stories: [
        {
          id: "hu-1",
          title: "Concluída",
          estimated_hours: 8,
          status: "concluída",
          team_id: "team-a",
          sprint_id: "sprint-1",
          assignee_id: "dev-1",
        },
        {
          id: "hu-2",
          title: "Ativa",
          estimated_hours: 4,
          status: "em_andamento",
          team_id: "team-a",
          sprint_id: "sprint-1",
          assignee_id: "dev-1",
        },
      ],
      activities: [],
    });

    expect(result[0].devs[0].allocatedHours).toBe(12);
    expect(result[0].devs[0].wipCount).toBe(1);
    expect(result[0].devs[0].tasks.map((task) => task.title)).toEqual(["Ativa"]);
  });
});
