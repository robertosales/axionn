import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("anuncia o erro e oferece retry quando disponível", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Falha ao carregar sprints" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar sprints");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
