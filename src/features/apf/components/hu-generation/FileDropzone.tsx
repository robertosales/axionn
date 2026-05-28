import { useCallback } from "react";
import { Upload, X, FileText, Table, File as FileIcon, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative group cursor-pointer border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out flex flex-col items-center justify-center gap-4",
          "hover:border-primary hover:bg-primary/[0.02] hover:shadow-inner",
          "border-border bg-muted/20"
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
        <div className="p-4 rounded-2xl bg-background shadow-xl border border-border group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-black uppercase tracking-tight">Solte seus documentos aqui</p>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest opacity-70">
            .MD • .DOCX • .XLSX • .PDF
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {files.map((file) => (
            <div
              key={file.name}
              className="group flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200 animate-in zoom-in-95"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  {file.status === "processing" ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : file.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black truncate uppercase tracking-tight">{file.name}</p>
                    {file.status === "success" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tracking-widest">
                      {formatSize(file.size)}
                    </p>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <p className="text-[9px] font-black text-primary uppercase">
                      {file.type}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(file.name);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
