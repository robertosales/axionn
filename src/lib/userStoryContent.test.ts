import { describe, expect, it } from "vitest";
import { buildUnifiedUserStoryContent, splitUserStoryContent } from "./userStoryContent";
import { parseUserStoryContent } from "../../supabase/functions/_shared/user-story-content";

describe("user story unified content", () => {
  it("extracts acceptance criteria from a markdown heading", () => {
    const value = "## Descrição\n\nFluxo principal.\n\n## Critérios de Aceite\n\n- Deve sincronizar";
    expect(splitUserStoryContent(value).acceptanceCriteria).toBe("- Deve sincronizar");
  });

  it("supports the legacy bold separator", () => {
    const value = "Descrição antiga\n\n---\n**Critérios de Aceite:**\nDado que...";
    expect(splitUserStoryContent(value).acceptanceCriteria).toBe("Dado que...");
  });

  it("combines a legacy separate criterion without duplicating an existing section", () => {
    expect(buildUnifiedUserStoryContent("Descrição", "Critério")).toContain("## Critérios de Aceite\n\nCritério");
    const existing = "Descrição\n\n## Critérios de Aceite\n\nCritério";
    expect(buildUnifiedUserStoryContent(existing, "Critério")).toBe(existing);
  });

  it("keeps frontend and GitLab extraction semantics aligned", () => {
    const value = "## Descrição\n\nFluxo.\n\n## Critérios de Aceite\n\n- Resultado esperado";
    expect(parseUserStoryContent(value)).toEqual({
      content: value,
      acceptanceCriteria: "- Resultado esperado",
    });
  });
});
