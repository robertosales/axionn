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
  const parts = prompt.split(/(\{\{[A-Z_]+\}\})/g);

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
      <div className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 rounded-md p-3 border border-border max-h-48 overflow-y-auto">
        {parts.map((part, index) => {
          const match = /^\{\{([A-Z_]+)\}\}$/.exec(part);
          if (!match) return <span key={index}>{part}</span>;
          const variable = VARIABLE_MAP.get(match[1]);
          return (
            <mark
              key={index}
              className={variable
                ? "bg-primary/10 text-primary rounded px-0.5 font-semibold not-italic"
                : "bg-destructive/10 text-destructive rounded px-0.5 font-semibold"}
            >
              {variable?.example ?? part}
            </mark>
          );
        })}
      </div>
    </div>
  );
}
