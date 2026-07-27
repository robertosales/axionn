import { describe, expect, it } from "vitest";
import {
  filterSalaAgilNavigation,
  salaAgilNavigationConfig,
} from "./NavigationConfig";

describe("Quality Intelligence navigation contract", () => {
  it("keeps Quality navigation for an entitled profile", () => {
    const sections = filterSalaAgilNavigation(true);

    expect(sections.some((section) => section.id === "sala-agil-quality")).toBe(
      true,
    );
  });

  it("removes the complete Quality section when access is denied", () => {
    const sections = filterSalaAgilNavigation(false);

    expect(sections.some((section) => section.id === "sala-agil-quality")).toBe(
      false,
    );
    expect(
      sections.flatMap((section) => section.items).some(
        (item) => item.route.startsWith("/sala-agil/qualidade"),
      ),
    ).toBe(false);
  });

  it("does not mutate the shared navigation declaration", () => {
    filterSalaAgilNavigation(false);

    expect(
      salaAgilNavigationConfig.some(
        (section) => section.id === "sala-agil-quality",
      ),
    ).toBe(true);
  });
});
