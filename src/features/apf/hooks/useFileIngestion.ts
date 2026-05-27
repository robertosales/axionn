import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { toast } from "sonner";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface IngestedFile {
  name: string;
  size: number;
  type: string;
  content: string;
  status: "processing" | "success" | "error";
  error?: string;
}

export function useFileIngestion() {
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = async (file: File): Promise<IngestedFile> => {
    const name = file.name;
    const type = file.name.split(".").pop()?.toLowerCase() || "";
    const size = file.size;

    try {
      let content = "";

      if (type === "md" || type === "txt") {
        content = await file.text();
      } else if (type === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (type === "xlsx" || type === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);

        let sheetMarkdown = "";
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

          if (json.length > 0) {
            sheetMarkdown += `### Planilha: ${sheetName}\n\n`;

            // Generate Markdown Table
            const headers = json[0];
            sheetMarkdown += "| " + headers.join(" | ") + " |\n";
            sheetMarkdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

            for (let i = 1; i < json.length; i++) {
              sheetMarkdown += "| " + json[i].join(" | ") + " |\n";
            }
            sheetMarkdown += "\n";
          }
        });
        content = sheetMarkdown;
      } else if (type === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let pdfText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: { str?: string }) => item.str || "").join(" ");
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
    }
  };

  const ingestFiles = useCallback(async (newFiles: File[]) => {
    setIsProcessing(true);
    const results: IngestedFile[] = [];

    for (const file of newFiles) {
      // Create initial processing entry
      setFiles(prev => [...prev, {
        name: file.name,
        size: file.size,
        type: file.name.split(".").pop() || "",
        content: "",
        status: "processing"
      }]);

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
    .map(f => `## Arquivo: ${f.name}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const totalCharacters = consolidatedMarkdown.length;
  // Rough estimation: 1 token ~= 4 chars for English, maybe 3 for PT-BR but let's stick to a safe side
  const estimatedTokens = Math.ceil(totalCharacters / 3.5);

  return {
    files,
    isProcessing,
    ingestFiles,
    removeFile,
    clearFiles,
    consolidatedMarkdown,
    totalCharacters,
    estimatedTokens,
  };
}
