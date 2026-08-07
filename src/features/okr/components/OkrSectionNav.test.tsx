import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { OkrSectionNav } from "./OkrSectionNav";

describe("OkrSectionNav", () => {
  it("offers persistent navigation among all OKR V2 sections", () => {
    render(
      <MemoryRouter initialEntries={["/okr/ciclos"]}>
        <OkrSectionNav />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "Navegação do OKR" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Visão geral" }),
    ).toHaveAttribute("href", "/okr/dashboard");
    expect(screen.getByRole("link", { name: "Ciclos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Objetivos" })).toHaveAttribute(
      "href",
      "/okr/objectives",
    );
  });
});
