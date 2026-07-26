import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync("src/components/layout/AppShell.tsx", "utf8");

describe("AppShell navigation boundary", () => {
  it("destructures the computed navigation config received by SidebarNav", () => {
    expect(appShell).toContain(
      "function SidebarNav({ collapsed, navigationConfig }:",
    );
    expect(appShell).toContain("sections={navigationConfig}");
  });
});
