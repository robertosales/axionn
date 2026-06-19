/**
 * AiPromptSuggestion
 * Botão + painel que envia uma descrição do template para a IA
 * e retorna um prompt sugerido pronto para usar.
 * Usa o provedor ativo do AiPipelineContext.
 */
import { useState } from "react";
import { Wand2, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAiPipeline } from "../../contexts/AiPipelineContext";
import { toast } from "sonner";

const SUGGESTION_META_PROMPT = `Você é um especialista em APF (Análise de Pontos de Função) e documentação ágil.
Crie um prompt de template completo em português para uso em um sistema de geração de documentos APF.
O prompt deve:
1. Ter instruções claras e objetivas para a IA
2. Incluir estrutura de saída esperada
3. Usar variáveis dinâmicas onde fizer sentido: {{SPRINT_NAME}}, {{TODAY}}, {{TEAM_NAME}}, {{SPRINT_TOTAL_PF}}
4. Ser conciso (máx 800 palavras)
5. Retornar APENAS o texto do prompt, sem explicações adicionais

Descrição do template desejado:
`;

interface Props {
  templateDescription: string;
  templateName: string;
  onApply: (prompt: string) => void;
}

export function AiPromptSuggestion({ templateDescription, templateName, onApply }: Props) {
  const { getAiPayload, selectedProvider } = useAiPipeline();
  const [loading, setLoading]   = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [expanded, setExpanded] = useState(false);

  const generate = async () => {
    const desc = templateDescription.trim() || templateName.trim();
    if (!desc) {
      toast.warning("Preencha o nome ou descrição do template antes de sugerir o prompt.");
      return;
    }
    setLoading(true);
    setSuggestion("");
    setExpanded(true);
    try {
      const aiPayload = getAiPayload();
      const finalPrompt = SUGGESTION_META_PROMPT + desc;

      const { data, error } = await supabase.functions.invoke("apf-generate", {
        body: {
          prompt:     finalPrompt,
          providerId: aiPayload.providerId,
          provider:   aiPayload.provider,
          apiKey:     aiPayload.apiKey,
          skipDocx:   true,
        },
      });

      if (error) throw new Error(error.message);
      const text: string = data?.markdown ?? data?.text ?? data?.content ?? JSON.stringify(data);
      setSuggestion(text);
    } catch (err: any) {
      toast.error("Erro ao gerar sugestão: " + (err?.message ?? "tente novamente"));
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={loading}
          className="gap-2 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          {loading ? "Gerando sugestão..." : `Sugerir prompt com IA (${selectedProvider?.name ?? "IA ativa"})`}
        </Button>
        {suggestion && !loading && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>

      {expanded && suggestion && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
          <Textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            className="min-h-[160px] font-mono text-xs bg-primary/3 border-primary/20"
          />
          <Button
            type="button"
            size="sm"
            className="gap-2 h-8 text-xs w-full"
            onClick={() => { onApply(suggestion); setExpanded(false); toast.success("Prompt aplicado!"); }}
          >
            <CheckCircle2 className="h-3 w-3" />
            Aplicar sugestão ao prompt
          </Button>
        </div>
      )}
    </div>
  );
}
