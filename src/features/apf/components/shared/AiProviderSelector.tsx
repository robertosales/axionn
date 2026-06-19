/**
 * AiProviderSelector
 * ------------------
 * Componente de seleção de provedor de IA compartilhado entre todas as abas.
 * Lê e grava no AiPipelineContext — quando o usuário muda aqui,
 * TODAS as abas passam a usar o novo provedor automaticamente.
 */
import { Zap, ChevronDown, Key } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiProvider } from "../../hooks/useAiProvider";

interface AiProviderSelectorProps {
  /** Exibe versão compacta (só o select, sem label e badge de modelo) */
  compact?: boolean;
}

export function AiProviderSelector({ compact = false }: AiProviderSelectorProps) {
  const {
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    needsApiKey,
    apiKey,
    setApiKey,
    loadingProviders,
    model,
    placeholder,
  } = useAiProvider();

  if (loadingProviders) {
    return <Skeleton className="h-9 w-48" />;
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-2"}>
      {!compact && (
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          Provedor de IA
        </Label>
      )}

      <div className="flex items-center gap-2">
        <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
          <SelectTrigger className={compact ? "h-8 text-xs w-48" : "h-9 text-sm"}>
            <SelectValue placeholder="Selecione o provedor" />
          </SelectTrigger>
          <SelectContent>
            {aiProviders.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  {p.is_recommended && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      recomendado
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!compact && model && (
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {model}
          </Badge>
        )}
      </div>

      {needsApiKey && (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-xs font-mono"
          />
        </div>
      )}
    </div>
  );
}
