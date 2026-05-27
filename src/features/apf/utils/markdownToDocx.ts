import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "docx";

const HEADER_FILL = "1F4E78";
const KEY_FILL = "D9D9D9";
const BORDER_COLOR = "9DB2BF";
const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR };
const cbs = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function makeCell(text: string, opts: { header?: boolean; keyCol?: boolean; width: number }): TableCell {
  const isBold = !!opts.header || !!opts.keyCol;
  const fill = opts.header ? HEADER_FILL : opts.keyCol ? KEY_FILL : undefined;
  const color = opts.header ? "FFFFFF" : "000000";
  return new TableCell({
    borders: cbs,
    width: { size: opts.width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text || "", bold: isBold, color, size: 20 })] })],
  });
}

function parseRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}
function isSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
function buildTable(header: string[], rows: string[][]): Table {
  const TOTAL = 9360;
  const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
  const w = Math.floor(TOTAL / cols);
  const trs: TableRow[] = [];
  trs.push(new TableRow({
    tableHeader: true,
    children: header.concat(Array(cols - header.length).fill("")).map((h) => makeCell(h, { header: true, width: w })),
  }));
  for (const r of rows) {
    const padded = r.concat(Array(cols - r.length).fill(""));
    trs.push(new TableRow({ children: padded.map((c) => makeCell(c, { width: w })) }));
  }
  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths: Array(cols).fill(w), rows: trs });
}

function mdToBlocks(text: string): (Paragraph | Table)[] {
  const lines = text.split(/\r?\n/);
  const out: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (line.trim().startsWith("|") && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = parseRow(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(parseRow(lines[i])); i++; }
      out.push(buildTable(header, rows));
      out.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    if (!line.trim()) out.push(new Paragraph({ children: [new TextRun("")] }));
    else if (line.startsWith("# ")) out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.slice(2), bold: true, size: 32 })], spacing: { before: 240, after: 160 } }));
    else if (line.startsWith("## ")) out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3), bold: true, size: 28 })], spacing: { before: 200, after: 120 } }));
    else if (line.startsWith("### ")) out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: line.slice(4), bold: true, size: 24 })], spacing: { before: 160, after: 100 } }));
    else if (line.startsWith("- ") || line.startsWith("* ")) out.push(new Paragraph({ children: [new TextRun(line.slice(2))], bullet: { level: 0 } }));
    else out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun(line)], spacing: { after: 120 } }));
    i++;
  }
  return out;
}

/** Converte markdown em um Blob .docx pronto para download. */
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: mdToBlocks(markdown),
    }],
  });
  return await Packer.toBlob(doc);
}

export function downloadMarkdownAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadDocxFromMarkdown(markdown: string, filename: string) {
  const blob = await markdownToDocxBlob(markdown);
  triggerDownload(blob, filename);
}
