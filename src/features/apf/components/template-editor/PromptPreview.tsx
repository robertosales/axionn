/**
 * PromptPreview
 * Painel de preview do prompt com variáveis resolvidas para exemplos.
 * Destaca visualmente as variáveis ainda não resolvidas.
 */
import { Eye, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { extractVariables, VARIABLE_MAP } from "../../utils/templateVariables";

interface Props {
  prompt: string;
}

export function PromptPreview({ prompt }: Props) {
  if (!prompt.trim()) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] text-muted-foreground text-xs">
        O preview aparecerá aqui enquanto você digita.
      </div>
    );
  }

  // Substitui variáveis por exemplo colorido
  const rendered = prompt.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    const v = VARIABLE_MAP.get(key);
    if (v) return `<mark class="bg-primary/10 text-primary rounded px-0.5 font-semibold not-italic">${v.example}</mark>`;
    return `<mark class="bg-destructive/10 text-destructive rounded px-0.5 font-semibold">${match}</mark>`;
  });

  const unknownVars = extractVariables(prompt).filter((k) => !VARIABLE_MAP.has(k));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Preview (com exemplos)</span>
        {unknownVars.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 gap-1 h-4">
            <AlertCircle className="h-2.5 w-2.5" />
            {unknownVars.length} variável(is) desconhecida(s)
          </Badge>
        )}
      </div>
      <div
        className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 rounded-md p-3 border border-border max-h-48 overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
