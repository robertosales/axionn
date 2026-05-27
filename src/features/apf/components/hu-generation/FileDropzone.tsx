import { useCallback } from "react";
import { Upload, X, FileText, Table, File as FileIcon, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { IngestedFile } from "../../hooks/useFileIngestion";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  files: IngestedFile[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
  isProcessing: boolean;
}

export function FileDropzone({ files, onFilesSelected, onRemoveFile, isProcessing }: FileDropzoneProps) {
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesSelected(droppedFiles);
      }
    },
    [onFilesSelected]
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === "xlsx" || t === "xls") return <Table className="h-4 w-4 text-emerald-500" />;
    if (t === "pdf") return <FileText className="h-4 w-4 text-rose-500" />;
    if (t === "docx" || t === "doc") return <FileText className="h-4 w-4 text-blue-500" />;
    return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out flex flex-col items-center justify-center gap-3",
          "hover:border-primary/50 hover:bg-primary/5",
          "border-border bg-muted/30"
        )}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          accept=".md,.docx,.xlsx,.xls,.pdf,.txt"
          onChange={(e) => {
            const selectedFiles = Array.from(e.target.files || []);
            if (selectedFiles.length > 0) {
              onFilesSelected(selectedFiles);
            }
          }}
        />
        <div className="p-3 rounded-full bg-background shadow-sm border border-border group-hover:scale-110 transition-transform">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">Clique ou arraste seus arquivos aqui</p>
          <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-tight">
            Suporta .md, .docx, .xlsx, .pdf (Máx. 10MB por arquivo)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {files.map((file) => (
            <div
              key={file.name}
              className="group flex items-center justify-between p-3 rounded-lg border border-border bg-card animate-in fade-in slide-in-from-left-2 duration-300"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="shrink-0">
                  {file.status === "processing" ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : file.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    {file.status === "success" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(file.size)} • {file.type.toUpperCase()}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(file.name);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
