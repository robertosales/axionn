import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Key, Zap } from "lucide-react";
import { AIProvider } from "@/features/admin/services/aiProviders.service";

interface AIProviderSelectorProps {
  providers: AIProvider[];
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const CONTEXT_LIMITS: Record<string, string> = {
  openai: "~128k tokens",
  anthropic: "~200k tokens",
  gemini: "~1M - 2M tokens",
  lovable: "~32k tokens (Recomendado)",
  perplexity: "~32k tokens",
  manus: "~128k tokens",
};

export function AIProviderSelector({
  providers,
  selectedProviderId,
  onProviderChange,
  apiKey,
  onApiKeyChange,
}: AIProviderSelectorProps) {
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId]
  );

  const providerCfg = useMemo(() => {
    if (!selectedProvider) return { needsKey: false, placeholder: "", contextLimit: "" };
    const isLovable = selectedProvider.provider_type === "lovable";
    const needsKey = !isLovable && !selectedProvider.has_key;
    const placeholderByType: Record<string, string> = {
      openai: "sk-...",
      gemini: "AIza...",
      anthropic: "sk-ant-...",
      perplexity: "pplx-...",
      lovable: "",
      manus: "api-...",
    };
    return {
      needsKey,
      placeholder: placeholderByType[selectedProvider.provider_type] ?? "Cole sua API key",
      contextLimit: CONTEXT_LIMITS[selectedProvider.provider_type] ?? "",
    };
  }, [selectedProvider]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Hub de IA</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Provedor</Label>
          <Select value={selectedProviderId} onValueChange={onProviderChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione um provedor" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    {p.provider_type === "lovable" ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>{p.name}</span>
                    {p.is_recommended && (
                      <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0 h-4 uppercase">Rec</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {providerCfg.needsKey && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex justify-between">
              Sua API Key (BYOK)
              <span className="text-[10px] lowercase font-normal italic">Salva apenas na sessão</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={providerCfg.placeholder}
              className="h-9 text-xs"
              autoComplete="off"
            />
          </div>
        )}

        {providerCfg.contextLimit && (
          <div className="flex items-center gap-1.5 pt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
            <span className="text-[10px] text-muted-foreground font-medium">
              Limite de contexto: <span className="text-foreground">{providerCfg.contextLimit}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
