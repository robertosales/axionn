import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("heavy dependency loading contract", () => {
  it("loads APF document parsers only when a file needs them", () => {
    const ingestion = source("src/features/apf/hooks/useFileIngestion.ts");
    const baseline = source("src/features/apf/services/apfBaselineParser.ts");

    for (const dependency of ["xlsx", "mammoth", "pdfjs-dist"]) {
      expect(ingestion).not.toMatch(new RegExp(`^import .*${dependency}`, "m"));
    }
    expect(ingestion).toContain('await import("mammoth")');
    expect(ingestion).toContain('await import("xlsx")');
    expect(ingestion).toContain('await import("pdfjs-dist")');
    expect(baseline).not.toContain('import * as XLSX from "xlsx"');
    expect(baseline).toContain('await import("xlsx")');
  });

  it("does not make Markdown downloads depend on DOCX", () => {
    const tab = source("src/features/apf/components/ApfHuGenerateTab.tsx");
    const download = source("src/features/apf/utils/fileDownload.ts");

    expect(tab).toContain('from "../utils/fileDownload"');
    expect(download).not.toContain('from "docx"');
  });

  it("loads report exporters only when the user exports", () => {
    const report = source("src/features/admin/utils/exportReport.ts");

    expect(report).not.toMatch(/^import .*from "(?:jspdf|jspdf-autotable|xlsx)"/m);
    expect(report).toContain('import("jspdf")');
    expect(report).toContain('import("jspdf-autotable")');
    expect(report).toContain('import("xlsx")');
  });
});
