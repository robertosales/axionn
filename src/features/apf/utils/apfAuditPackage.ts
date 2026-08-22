import type { ApfAuditPackageData } from "../types/apfEvidenceDossier.types";
import { triggerDownload } from "./fileDownload";

const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-");

export async function downloadApfAuditZip(data: ApfAuditPackageData) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const fixedDate = new Date(data.batch.updatedAt);
  const manifest = {
    schema: "axionn.apf.audit-package.v1",
    batch: { ...data.batch },
    dossiers: data.dossiers.map(({ markdown, ...item }) => item),
    decisions: data.decisions,
  };
  const options = { date: fixedDate, createFolders: false };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2), options);
  for (const dossier of data.dossiers)
    zip.file(
      `dossiers/${safe(dossier.code)}-v${dossier.version}.md`,
      dossier.markdown,
      options,
    );
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
  triggerDownload(blob, `${safe(data.batch.code)}-auditoria.zip`);
}

export async function downloadApfAuditPdf(data: ApfAuditPackageData) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setCreationDate(new Date(data.batch.updatedAt));
  doc.setProperties({
    title: `Pacote de Auditoria APF - ${data.batch.code}`,
    subject: "Dossiês APF homologados e trilha formal de decisões",
    creator: "Axionn",
  });
  doc.setFontSize(16);
  doc.text(`Pacote de Auditoria APF · ${data.batch.code}`, 14, 18);
  doc.setFontSize(10);
  const cover = [
    `Competência: ${data.batch.competence.slice(0, 7)}`,
    `Status: ${data.batch.status}`,
    `Total: ${data.batch.totalPf.toLocaleString("pt-BR")} PF`,
    `PF em glosa: ${data.batch.disputedPf.toLocaleString("pt-BR")} PF`,
    "",
    ...data.dossiers.map(
      (d) =>
        `${d.code} · v${d.version} · ${d.pf.toLocaleString("pt-BR")} PF · SHA-256 ${d.hash}`,
    ),
    "",
    "Trilha de decisões",
    ...data.decisions.map((d) => `${d.createdAt} · ${d.decision} · ${d.note}`),
  ];
  writePaginatedText(doc, cover.join("\n"), 28);
  for (const dossier of data.dossiers) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text(
      `${dossier.code} · versão ${dossier.version} · ${dossier.pf.toLocaleString("pt-BR")} PF`,
      14,
      16,
    );
    doc.setFontSize(8);
    doc.text(`SHA-256 ${dossier.hash}`, 14, 22);
    doc.setFontSize(9);
    writePaginatedText(doc, dossier.markdown, 30);
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`Página ${page} de ${pages}`, 196, 290, { align: "right" });
  }
  doc.save(`${safe(data.batch.code)}-auditoria.pdf`);
}

type PdfWriter = {
  splitTextToSize(text: string, width: number): string[];
  text(text: string | string[], x: number, y: number): unknown;
  addPage(): unknown;
};
function writePaginatedText(doc: PdfWriter, content: string, initialY: number) {
  const wrapped = doc.splitTextToSize(content, 180);
  let y = initialY;
  for (const line of wrapped) {
    if (y > 280) {
      doc.addPage();
      y = 16;
    }
    doc.text(line, 14, y);
    y += 4.2;
  }
}
