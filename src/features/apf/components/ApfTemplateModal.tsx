/**
 * ApfTemplateModal (v2 — Fase 3)
 * ---------------------------------
 * Melhorias:
 *  1. Painel de variáveis dinâmicas com chips clicáveis (insere {{KEY}} no cursor)
 *  2. Preview ao vivo do prompt com variáveis resolvidas para exemplos
 *  3. Botão "Sugerir prompt com IA" via AiPromptSuggestion
 *  4. Contador de caracteres e tokens estimados no editor
 *  5. Layout split: editor (esq) + preview + variáveis (dir)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";
import type { ApfTemplate } from "../services/apf.service";
import { useApfModules } from "../hooks/useApfModules";
import {
  TEMPLATE_VARIABLES, VARIABLE_CATEGORIES,
  type TemplateVariable
} from "../utils/templateVariables";
import { VariableChip }     from "./template-editor/VariableChip";
import { PromptPreview }    from "./template-editor/PromptPreview";
import { AiPromptSuggestion } from "./template-editor/AiPromptSuggestion";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string; description: string;
    output_type: string; prompt_content: string; module_id: string | null;
  }) => Promise<void>;
  template?: ApfTemplate | null;
}

/** Estima tokens (aproximação ~4 chars/token) */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function ApfTemplateModal({ open, onClose, onSave, template }: Props) {
  const { modules, loading: loadingModules } = useApfModules();

  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [outputType, setOutputType]   = useState("docx");
  const [moduleId, setModuleId]       = useState<string>("none");
  const [promptContent, setPromptContent] = useState("");
  const [saving, setSaving]           = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setOutputType(template?.output_type ?? "docx");
      setModuleId(template?.module_id ?? "none");
      setPromptContent(template?.prompt_content ?? "");
      setShowPreview(false);
    }
  }, [open, template]);

  /** Insere {{KEY}} na posição do cursor no textarea */
  const insertVariable = useCallback((key: string) => {
    const ta = textareaRef.current;
    if (!ta) { setPromptContent((p) => p + `{{${key}}}`); return; }
    const start = ta.selectionStart ?? promptContent.length;
    const end   = ta.selectionEnd   ?? promptContent.length;
    const token = `{{${key}}}`;
    const next  = promptContent.slice(0, start) + token + promptContent.slice(end);
    setPromptContent(next);
    // Reposiciona o cursor após o token inserido
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }, [promptContent]);

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
  const tokens  = estimateTokens(promptContent);

  // Agrupa variáveis por categoria
  const grouped = TEMPLATE_VARIABLES.reduce<Record<string, TemplateVariable[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Modal wide para acomodar o layout split */}
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
          <DialogDescription>
            {template
              ? "Atualize as informações do template. A versão será incrementada automaticamente."
              : "Crie um template com variáveis dinâmicas e preview ao vivo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Linha 1: Nome + Módulo + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contagem de HUs por Sprint" />
            </div>
            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select value={moduleId} onValueChange={setModuleId} disabled={loadingModules}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingModules ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground">Todos os módulos</span></SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição <span className="text-muted-foreground text-xs">({description.length}/300)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Descreva brevemente o objetivo deste template" className="min-h-[52px]" />
          </div>

          {/* Sugestão por IA */}
          <AiPromptSuggestion
            templateName={name}
            templateDescription={description}
            onApply={setPromptContent}
          />

          {/* Layout split: Editor (esq) + Painel direito */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Editor do prompt */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Prompt do Template <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    ~{tokens.toLocaleString("pt-BR")} tokens
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {promptContent.length.toLocaleString("pt-BR")} chars
                  </Badge>
                </div>
              </div>
              <Textarea
                ref={textareaRef}
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="Escreva as instruções para a IA ou clique nas variáveis à direita para inserí-las..."
                className="min-h-[300px] font-mono text-xs resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                💡 Clique nos chips de variáveis para inserir no cursor. O preview mostra como ficará com dados reais.
              </p>
            </div>

            {/* Painel direito: Variáveis + Preview */}
            <div className="lg:col-span-2 space-y-4">

              {/* Variáveis dinâmicas */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Variáveis Dinâmicas
                </p>
                <Accordion type="multiple" defaultValue={["sprint"]} className="space-y-1">
                  {Object.entries(grouped).map(([cat, vars]) => (
                    <AccordionItem key={cat} value={cat} className="border-none">
                      <AccordionTrigger className="py-1 text-[11px] font-semibold hover:no-underline">
                        {VARIABLE_CATEGORIES[cat as keyof typeof VARIABLE_CATEGORIES]}
                        <Badge variant="secondary" className="ml-auto mr-2 text-[9px] h-4 px-1">
                          {vars.length}
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {vars.map((v) => (
                            <VariableChip key={v.key} variable={v} onClick={insertVariable} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Preview ao vivo */}
              <div className="rounded-lg border border-border bg-background p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setShowPreview((p) => !p)}
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                    Preview ao vivo
                    <span className="text-[9px] normal-case">{showPreview ? "▲ ocultar" : "▼ mostrar"}</span>
                  </p>
                </button>
                {showPreview && (
                  <div className="mt-2">
                    <PromptPreview prompt={promptContent} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving} className="gap-2">
            {saving ? "Salvando..." : (template ? "Atualizar Template" : "Criar Template")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
