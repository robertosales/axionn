import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import type { ApfTemplate } from "../services/apf.service";
import { useApfModules } from "../hooks/useApfModules";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    output_type: string;
    prompt_content: string;
    module_id: string | null;
  }) => Promise<void>;
  template?: ApfTemplate | null;
}

export function ApfTemplateModal({ open, onClose, onSave, template }: Props) {
  const { modules, loading: loadingModules } = useApfModules();

  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [outputType, setOutputType]   = useState("docx");
  const [moduleId, setModuleId]       = useState<string>("none");
  const [promptContent, setPromptContent] = useState("");
  const [saving, setSaving]           = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setOutputType(template?.output_type ?? "docx");
      setModuleId(template?.module_id ?? "none");
      setPromptContent(template?.prompt_content ?? "");
    }
  }, [open, template]);

  const handleSubmit = async () => {
    if (!name.trim() || !outputType || !promptContent.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        output_type: outputType,
        prompt_content: promptContent,
        module_id: moduleId === "none" ? null : moduleId,
      });
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
            {template
              ? "Atualize as informações do template. A versão será incrementada automaticamente."
              : "Preencha os campos para criar um novo template de geração APF."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* Nome */}
          <div className="space-y-1.5">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Contagem de HUs por Sprint"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>
              Descrição{" "}
              <span className="text-muted-foreground text-xs">({description.length}/300)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Descreva brevemente o objetivo deste template"
              className="min-h-[60px]"
            />
          </div>

          {/* Módulo + Tipo de saída lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Módulo <span className="text-destructive">*</span></Label>
              <Select
                value={moduleId}
                onValueChange={setModuleId}
                disabled={loadingModules}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingModules ? "Carregando..." : "Selecione o módulo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sem módulo (todos)</span>
                  </SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label>
              Conteúdo do Template / Prompt{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              ref={textareaRef}
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="Descreva as instruções para a IA gerar o documento..."
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
