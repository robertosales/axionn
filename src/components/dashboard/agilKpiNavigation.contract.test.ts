import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/dashboard/AgilView.tsx", "utf8");

describe("Sala Ágil KPI card navigation", () => {
  it("renders actionable KPI cards as native buttons", () => {
    expect(source).toContain("<button");
    expect(source).toContain('type="button"');
    expect(source).toContain("onClick={() => navigate(to)}");
    expect(source).toContain("aria-label={`Abrir ${label}`}");
  });

  it("opens the Board for HU completion, progress and bugs", () => {
    expect(source.match(/to="\/sala-agil\/board"/g)).toHaveLength(3);
  });

  it("opens impediment management from the impediment card", () => {
    expect(source).toContain('to="/sala-agil/impedimentos"');
  });

  it("opens each secondary KPI destination", () => {
    expect(source).toContain('to="/sala-agil/historico"');
    expect(source).toContain('to="/sala-agil/atividades"');
    expect(source).toContain('to="/sala-agil/equipe"');
    expect(source).toContain('to="/sala-agil/metricas"');
  });

  it("opens contextual details for HUs and team members", () => {
    expect(source).toContain("onClick={() => setSelectedHuId(hu.id)}");
    expect(source).toContain("aria-label={`Abrir detalhes da ${hu.code}`}");
    expect(source).toContain("<HUEditDrawer");
    expect(source).toContain("onClick={() => setSelectedDeveloper(dev)}");
    expect(source).toContain("aria-label={`Abrir informações de ${formatPersonName(dev.name)}`}");
    expect(source).toContain("<Dialog open={selectedDeveloper !== null}");
  });

  it("provides visible pointer, keyboard and hover affordances", () => {
    expect(source).toContain("cursor-pointer");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("group-hover:translate-x-0.5");
  });
});
