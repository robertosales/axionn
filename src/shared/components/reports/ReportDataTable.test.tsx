import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportDataTable } from "./ReportDataTable";

describe("ReportDataTable", () => {
  it("expõe ordenação acessível e alterna a direção pelo controle focável", () => {
    render(
      <ReportDataTable
        columns={[
          { key: "name", header: "Nome", sortable: true },
          { key: "total", header: "Total" },
        ]}
        data={[
          { name: "Beta", total: 2 },
          { name: "Alpha", total: 1 },
        ]}
      />,
    );

    const nameHeader = screen.getByRole("columnheader", { name: "Nome" });
    const sortButton = screen.getByRole("button", { name: "Ordenar por Nome" });

    expect(nameHeader).toHaveAttribute("aria-sort", "none");
    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "none");

    fireEvent.click(sortButton);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Alpha");

    fireEvent.click(sortButton);
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Beta");
  });
});
