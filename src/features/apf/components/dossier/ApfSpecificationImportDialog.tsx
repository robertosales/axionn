import { useEffect, useState } from "react";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFileIngestion } from "../../hooks/useFileIngestion";
import { importApfFunctionalSpecification } from "../../services/apfEvidenceDossier.service";
import {
  extractApfSpecificationFromText,
  type ExtractedApfCriterion,
  type ExtractedApfSpecification,
} from "../../utils/apfSpecificationExtraction";
export function ApfSpecificationImportDialog({
  open,
  onOpenChange,
  dossierId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossierId: string;
  onImported: () => Promise<unknown>;
}) {
  const { ingestFiles, isProcessing } = useFileIngestion();
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [criteria, setCriteria] = useState<ExtractedApfCriterion[]>([]);
  const [extraction, setExtraction] =
    useState<ExtractedApfSpecification | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) {
      setFileName("");
      setContent("");
      setCriteria([]);
      setExtraction(null);
    }
  }, [open]);
  const choose = async (file?: File) => {
    if (!file) return;
    const [result] = await ingestFiles([file]);
    if (result.status === "error") {
      toast.error(result.error ?? "Falha ao ler arquivo.");
      return;
    }
    setFileName(result.name);
    setContent(result.content);
    const extracted = extractApfSpecificationFromText(result.content);
    setExtraction(extracted);
    setCriteria(extracted.criteria);
    if (!extracted.criteria.length)
      toast.warning(
        "Nenhum critério reconhecido. Revise o texto ou cadastre manualmente.",
      );
  };
  const save = async () => {
    setSaving(true);
    try {
      const count = await importApfFunctionalSpecification(
        dossierId,
        fileName,
        content,
        criteria,
        extraction ? { ...extraction, criteria } : undefined,
      );
      toast.success(`${count} critério(s) importado(s) para revisão.`);
      onOpenChange(false);
      await onImported();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao importar especificação.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar especificação funcional</DialogTitle>
          <DialogDescription>
            TXT, Markdown, DOCX e PDF são convertidos em texto. Revise cada
            critério; nenhum item será aprovado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="apf-spec-file">Arquivo da especificação</Label>
            <Input
              id="apf-spec-file"
              type="file"
              accept=".txt,.md,.docx,.pdf"
              onChange={(event) => void choose(event.target.files?.[0])}
              disabled={isProcessing || saving}
            />
          </div>
          {isProcessing && (
            <p className="flex items-center text-sm" role="status">
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
              Extraindo texto…
            </p>
          )}
          {fileName && (
            <div
              aria-live="polite"
              className="rounded-md border bg-muted/40 p-3 text-sm"
            >
              <strong>{fileName}</strong>
              <span className="ml-2 text-muted-foreground">
                {content.length.toLocaleString("pt-BR")} caracteres ·{" "}
                {criteria.length} critérios
              </span>
            </div>
          )}
          {extraction && (
            <div
              className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2"
              aria-label="Resumo da extração funcional"
            >
              <p className="sm:col-span-2">
                <strong>Objetivo:</strong>{" "}
                {extraction.objective ?? "Não identificado"}
              </p>
              <p>
                <strong>Atores:</strong> {extraction.actors.length}
              </p>
              <p>
                <strong>Regras de negócio:</strong>{" "}
                {extraction.businessRules.length}
              </p>
              <p>
                <strong>Objetos funcionais:</strong>{" "}
                {extraction.functionalObjects.length}
              </p>
              <p>
                <strong>Operações:</strong> {extraction.operations.length}
              </p>
              <p>
                <strong>Fronteiras:</strong> {extraction.boundaries.length}
              </p>
              <p>
                <strong>Requisitos não funcionais:</strong>{" "}
                {extraction.nonFunctionalRequirements.length}
              </p>
            </div>
          )}
          {criteria.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="font-medium">
                Critérios propostos para revisão
              </legend>
              {criteria.map((item, index) => (
                <div
                  key={`${item.stableId}-${index}`}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[6rem_1fr_auto]"
                >
                  <div>
                    <Label htmlFor={`import-stable-${index}`}>ID</Label>
                    <Input
                      id={`import-stable-${index}`}
                      value={item.stableId}
                      onChange={(e) =>
                        setCriteria((all) =>
                          all.map((value, i) =>
                            i === index
                              ? { ...value, stableId: e.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`import-text-${index}`}>
                      Texto original
                    </Label>
                    <Textarea
                      id={`import-text-${index}`}
                      value={item.originalText}
                      onChange={(e) =>
                        setCriteria((all) =>
                          all.map((value, i) =>
                            i === index
                              ? {
                                  ...value,
                                  originalText: e.target.value,
                                  expectedBehavior: e.target.value,
                                }
                              : value,
                          ),
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-end"
                    aria-label={`Remover ${item.stableId}`}
                    onClick={() =>
                      setCriteria((all) =>
                        all
                          .filter((_, i) => i !== index)
                          .map((value, i) => ({ ...value, sortOrder: i })),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </fieldset>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void save()}
            disabled={
              saving ||
              isProcessing ||
              !fileName ||
              !content.trim() ||
              !criteria.length
            }
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Importar para revisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
