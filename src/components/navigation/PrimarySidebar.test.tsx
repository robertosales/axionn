import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { salaAgilNavigationConfig } from "./NavigationConfig";
import { NavigationList } from "./PrimarySidebar";

describe("NavigationList", () => {
  it("marca somente a rota de qualidade mais específica", () => {
    render(
      <MemoryRouter initialEntries={["/sala-agil/qualidade/casos"]}>
        <NavigationList sections={salaAgilNavigationConfig} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Casos de Teste" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Visão Geral" })).not.toHaveAttribute("aria-current");
  });

  it("permite recolher e expandir os grupos da navegação", () => {
    render(
      <MemoryRouter initialEntries={["/sala-agil/dashboard"]}>
        <NavigationList sections={salaAgilNavigationConfig} />
      </MemoryRouter>,
    );

    const sprintTrigger = screen.getByRole("button", { name: "Sprints" });
    expect(sprintTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(sprintTrigger);
    expect(sprintTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(sprintTrigger);
    expect(sprintTrigger).toHaveAttribute("aria-expanded", "true");
  });

  it("inicia somente o primeiro grupo expandido", () => {
    render(
      <MemoryRouter initialEntries={["/sala-agil/dashboard"]}>
        <NavigationList sections={salaAgilNavigationConfig} />
      </MemoryRouter>,
    );

    const sectionTriggers = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));

    expect(sectionTriggers[0]).toHaveTextContent("Sprints");
    expect(sectionTriggers[0]).toHaveAttribute("aria-expanded", "true");
    sectionTriggers.slice(1).forEach((trigger) => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });
});
