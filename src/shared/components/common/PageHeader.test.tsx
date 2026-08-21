import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renderiza um único h1 na variante operacional", () => {
    render(
      <PageHeader
        title="Kanban"
        description="Acompanhe o fluxo da sprint."
        icon={Layers}
        badges={[{ label: "12 HUs" }]}
        actions={<Button>Atualizar</Button>}
      />,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Kanban" });
    expect(heading).toHaveAccessibleDescription("Acompanhe o fluxo da sprint.");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("12 HUs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
  });

  it("preserva a variante Admin sem heading duplicado", () => {
    render(
      <PageHeader
        variant="admin"
        description="3 projetos ativos"
        icon={Layers}
        badges={[{ label: "Contrato A" }]}
      />,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("3 projetos ativos")).toBeInTheDocument();
    expect(screen.getByText("Contrato A")).toBeInTheDocument();
  });
});
