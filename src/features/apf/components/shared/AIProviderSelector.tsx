import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Key, Zap, Info } from "lucide-react";
import { AIProvider } from "@/features/admin/services/aiProviders.service";

interface AIProviderSelectorProps {
  providers: AIProvider[];
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const CONTEXT_LIMITS: Record<string, { label: string; color: string }> = {
  openai: { label: "~128k Tokens", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  anthropic: { label: "~200k Tokens", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  gemini: { label: "~1M Tokens", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  lovable: { label: "Ilimitado (Recomendado)", color: "bg-primary/10 text-primary border-primary/20" },
  perplexity: { label: "~32k Tokens", color: "bg-zinc-500/10 text-zinc-600 border-zinc-200" },
  manus: { label: "~128k Tokens", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
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
    if (!selectedProvider) return { needsKey: false, placeholder: "", contextLimit: null };
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
      contextLimit: CONTEXT_LIMITS[selectedProvider.provider_type] ?? null,
    };
  }, [selectedProvider]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-tight">Hub de IA Multi-Provedor</h3>
        </div>
        {selectedProvider?.provider_type === "lovable" && (
          <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20 font-bold">
            EMBUTIDO
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            Selecione o Provedor
          </Label>
          <Select value={selectedProviderId} onValueChange={onProviderChange}>
            <SelectTrigger className="h-10 text-sm font-medium focus:ring-primary/20">
              <SelectValue placeholder="Escolha a inteligência artificial..." />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                  <div className="flex items-center gap-2 py-0.5">
                    {p.provider_type === "lovable" ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Key className="h-4 w-4 text-muted-foreground/70" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{p.name}</span>
                      {p.provider_type === "lovable" && (
                        <span className="text-[9px] text-muted-foreground leading-none">Gemini/GPT — Recomendado</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {providerCfg.needsKey && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Traga sua Própria Chave (BYOK)
              </Label>
              <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold uppercase">
                <Info className="h-3 w-3" />
                Sessão Segura
              </div>
            </div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={providerCfg.placeholder}
              className="h-10 text-sm font-mono bg-muted/30 focus:bg-background transition-colors"
              autoComplete="off"
            />
            <p className="text-[9px] text-muted-foreground leading-relaxed italic">
              Sua chave é armazenada apenas no sessionStorage local e nunca toca nossos servidores permanentemente.
            </p>
          </div>
        )}

        {providerCfg.contextLimit && (
          <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Limite de Contexto Recomendado:
            </span>
            <Badge variant="outline" className={`w-fit py-1 px-3 text-[10px] font-bold uppercase tracking-tight ${providerCfg.contextLimit.color}`}>
              {providerCfg.contextLimit.label}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
