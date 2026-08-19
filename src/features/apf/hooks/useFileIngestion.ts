import { useState, useCallback } from "react";
import { toast } from "sonner";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_WORKBOOK_SHEETS = 100;
const MAX_SHEET_ROWS = 100_000;
const MAX_PDF_PAGES = 500;

export interface IngestedFile {
  name: string;
  size: number;
  type: string;
  content: string;
  status: "processing" | "success" | "error";
  error?: string;
  progress?: number;
}

export function useFileIngestion() {
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string | null>(null);

  const processFile = async (file: File): Promise<IngestedFile> => {
    const name = file.name;
    const type = file.name.split(".").pop()?.toLowerCase() || "";
    const size = file.size;

    setCurrentProcessingFile(name);

    try {
      if (size > MAX_FILE_BYTES) {
        throw new Error("Arquivo excede o limite de 20 MB");
      }

      let content = "";

      if (type === "md" || type === "txt") {
        content = await file.text();
      } else if (type === "docx") {
        const { default: mammoth } = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (type === "xlsx" || type === "xls") {
        const XLSX = await import("xlsx");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        if (workbook.SheetNames.length > MAX_WORKBOOK_SHEETS) {
          throw new Error(`Planilha excede o limite de ${MAX_WORKBOOK_SHEETS} abas`);
        }

        let sheetMarkdown = "";
        // Support multiple sheets as requested (at least two or more)
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as unknown[][];
          if (json.length > MAX_SHEET_ROWS) {
            throw new Error(`A aba ${sheetName} excede o limite de ${MAX_SHEET_ROWS.toLocaleString("pt-BR")} linhas`);
          }

          if (json.length > 0) {
            sheetMarkdown += `### Planilha: ${sheetName}\n\n`;

            // Filter out empty rows
            const validRows = json.filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== ""));

            if (validRows.length > 0) {
              const headers = validRows[0];
              sheetMarkdown += "| " + headers.map(h => String(h || "").replace(/\|/g, "\\|")).join(" | ") + " |\n";
              sheetMarkdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

              for (let i = 1; i < validRows.length; i++) {
                sheetMarkdown += "| " + validRows[i].map(c => String(c || "").replace(/\|/g, "\\|")).join(" | ") + " |\n";
              }
              sheetMarkdown += "\n";
            }
          }
        });
        content = sheetMarkdown;
      } else if (type === "pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (pdf.numPages > MAX_PDF_PAGES) {
          throw new Error(`PDF excede o limite de ${MAX_PDF_PAGES} páginas`);
        }
        let pdfText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          pdfText += `--- Página ${i} ---\n${pageText}\n\n`;
        }
        content = pdfText;
      } else {
        throw new Error("Formato não suportado");
      }

      return { name, size, type, content, status: "success" };
    } catch (err: unknown) {
      console.error(`Erro ao processar ${name}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { name, size, type, content: "", status: "error", error: errorMessage };
    } finally {
      setCurrentProcessingFile(null);
    }
  };

  const ingestFiles = useCallback(async (newFiles: File[]) => {
    setIsProcessing(true);
    const results: IngestedFile[] = [];

    for (const file of newFiles) {
      // Avoid duplicates in the same batch or existing
      setFiles(prev => {
        const filtered = prev.filter(f => f.name !== file.name);
        return [...filtered, {
          name: file.name,
          size: file.size,
          type: file.name.split(".").pop() || "",
          content: "",
          status: "processing",
          progress: 0
        }];
      });

      const result = await processFile(file);

      setFiles(prev => prev.map(f => f.name === file.name ? result : f));
      results.push(result);
    }

    setIsProcessing(false);
    return results;
  }, []);

  const removeFile = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const consolidatedMarkdown = files
    .filter(f => f.status === "success")
    .map(f => `## Origem: ${f.name}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const totalCharacters = consolidatedMarkdown.length;
  const totalBytes = new TextEncoder().encode(consolidatedMarkdown).length;

  // Conservative estimate: 1 token ≈ 3.5 chars for mixed PT-BR/Technical text
  const estimatedTokens = Math.ceil(totalCharacters / 3.5);

  return {
    files,
    isProcessing,
    currentProcessingFile,
    ingestFiles,
    removeFile,
    clearFiles,
    consolidatedMarkdown,
    totalCharacters,
    totalBytes,
    estimatedTokens,
  };
}
