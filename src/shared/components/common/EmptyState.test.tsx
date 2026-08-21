import { fireEvent, render, screen } from "@testing-library/react";
import { SearchX } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("preserva o estado vazio como variante padrão", () => {
    render(<EmptyState icon={SearchX} title="Nenhum registro" />);

    const state = screen.getByRole("status");
    expect(state).toHaveAttribute("data-state-variant", "empty");
    expect(state).toHaveAttribute("aria-live", "polite");
    expect(state).toHaveTextContent("Nenhum registro");
  });

  it("distingue resultado filtrado vazio e permite limpar filtros", () => {
    const onClear = vi.fn();
    render(
      <EmptyState
        icon={SearchX}
        variant="filtered-empty"
        title="Nenhum resultado para os filtros"
        actionLabel="Limpar filtros"
        onAction={onClear}
      />,
    );

    const state = screen.getByRole("status");
    expect(state).toHaveAttribute("data-state-variant", "filtered-empty");
    expect(state).toHaveTextContent("Nenhum resultado para os filtros");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
