import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportFilterBar } from "./ReportFilterBar";

describe("ReportFilterBar", () => {
  it("conta valores diferentes dos defaults e limpa todos", () => {
    const onReset = vi.fn();
    render(
      <ReportFilterBar
        fields={[
          { key: "search", label: "Busca", type: "text" },
          { key: "from", label: "Início", type: "date" },
        ]}
        values={{ search: "login", from: "" }}
        defaultValues={{ search: "", from: "" }}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );

    expect(screen.getByText("1 filtro ativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Busca")).toHaveValue("login");
    fireEvent.click(screen.getByRole("button", { name: "Limpar todos" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("mantém a limpeza visível e desabilitada sem filtros ativos", () => {
    render(
      <ReportFilterBar
        fields={[{ key: "search", label: "Busca", type: "text" }]}
        values={{ search: "" }}
        defaultValues={{ search: "" }}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("0 filtros ativos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar todos" })).toBeDisabled();
  });

  it("permite sobrescrever a contagem para semânticas especializadas", () => {
    render(
      <ReportFilterBar
        fields={[{ key: "status", label: "Status", type: "text" }]}
        values={{ status: "custom" }}
        onChange={vi.fn()}
        activeFilterCount={3}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("3 filtros ativos")).toBeInTheDocument();
  });
});
