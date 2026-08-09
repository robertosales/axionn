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

    const qualityTrigger = screen.getByRole("button", { name: "Qualidade" });
    expect(qualityTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(qualityTrigger);
    expect(qualityTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(qualityTrigger);
    expect(qualityTrigger).toHaveAttribute("aria-expanded", "true");
  });
});
