import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SprintHistoryTable } from "./SprintHistoryTable";
import type { SprintMetrics } from "../hooks/useSprintHistory";

const sprint: SprintMetrics = {
  sprintId: "sprint-1",
  sprintName: "Sprint 42",
  teamId: "team-1",
  teamName: "Plataforma",
  startDate: "2026-08-01",
  endDate: "2026-08-14",
  durationDays: 14,
  totalHUs: 8,
  completedHUs: 7,
  husConcluidadas: 7,
  completionRate: 87.5,
  taxaConclusao: 87.5,
  plannedPoints: 34,
  deliveredPoints: 31,
  velocity: 31,
  velocityPontos: 31,
  horasPlanejadas: 120,
  horasRealizadas: 124,
  desvioHoras: 4,
  impedimentos: 1,
  avgCycleTime: 2.5,
  bugs: 0,
  rework: 0,
  devStats: [],
};

describe("SprintHistoryTable", () => {
  it.each(["Enter", " "])("abre a sprint pelo teclado com %p", (key) => {
    const onSelect = vi.fn();
    render(<SprintHistoryTable metrics={[sprint]} onSelect={onSelect} />);

    const row = screen.getByRole("row", { name: "Abrir detalhes da sprint Sprint 42" });
    expect(row).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(row, { key });

    expect(onSelect).toHaveBeenCalledWith(sprint);
  });
});
