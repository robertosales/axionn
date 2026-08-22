import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ModuleQuickAccess } from "./ModuleQuickAccess";

const kpis = {
  totalTimes: 3,
  timesSalaAgil: 1,
  timesSustentacao: 1,
  totalHUs: 0,
  husConcluidasAtivas: 0,
  impedimentosAbertos: 0,
  backlogTotal: 0,
  velocityPontos: 0,
  demandasAbertas: 0,
  demandasConcluidas: 0,
  demandasBloqueadas: 0,
  slaEmRisco: 0,
  timesComSprintAtrasada: 0,
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("ModuleQuickAccess", () => {
  it.each([
    ["Sala Ágil", "/sala-agil/dashboard"],
    ["Sustentação", "/sustentacao/dashboard"],
    ["RDM", "/rdm/dashboard"],
  ])("opens %s using its canonical deep link", (label, expectedPath) => {
    render(
      <MemoryRouter initialEntries={["/dashboard-admin"]}>
        <ModuleQuickAccess kpis={kpis} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
    expect(screen.getByTestId("location")).toHaveTextContent(expectedPath);
  });
});
