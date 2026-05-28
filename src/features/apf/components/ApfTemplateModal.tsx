import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApfTemplate } from "../services/apf.service";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string; output_type: string; prompt_content: string }) => Promise<void>;
  template?: ApfTemplate | null;
}

export function ApfTemplateModal({ open, onClose, onSave, template }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputType, setOutputType] = useState("docx");
  const [promptContent, setPromptContent] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setOutputType(template?.output_type ?? "docx");
      setPromptContent(template?.prompt_content ?? "");
    }
  }, [open, template]);

  const handleSubmit = async () => {
    if (!name.trim() || !outputType || !promptContent.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), output_type: outputType, prompt_content: promptContent });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isValid = name.trim() && outputType && promptContent.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
          <DialogDescription>
            {template ? "Atualize as informações do template. A versão será incrementada automaticamente." : "Preencha os campos para criar um novo template de geração APF."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Contagem de HUs por Sprint" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição <span className="text-muted-foreground text-xs">({description.length}/300)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Descreva brevemente o objetivo deste template"
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de saída <span className="text-destructive">*</span></Label>
            <Select value={outputType} onValueChange={setOutputType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="md">Markdown (.md)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo do Template / Prompt <span className="text-destructive">*</span></Label>
            <Textarea
              ref={textareaRef}
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="Descreva as instruções para a IA gerar o documento. Você pode descrever o formato, seções, tópicos esperados, etc. Para títulos use '# Título' (H1) ou '## Subtítulo' (H2). Para listas, use '- item'."
              className="min-h-[280px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground pt-1">
              💡 Dica: o conteúdo dos arquivos enviados (Baseline, HUs, Modelo) é injetado automaticamente como contexto antes do seu prompt.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? "Salvando..." : "Salvar Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}