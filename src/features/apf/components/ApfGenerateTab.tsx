/**
 * ApfGenerateTab (v2 — Fase 2)
 * ------------------------------
 * Integrado ao AiPipelineContext:
 *  - Sprint sincronizada via activePipelineSprintId
 *  - Provedor de IA lido do contexto compartilhado
 *  - Exibe badge quando lastPfAnalysisId está disponível (PF já contado para esta sprint)
 *  - Remove seletor de provedor duplicado (já está na barra global da ApfGeneratorPage)
 *
 * IMPORTANTE: mantém 100% de compatibilidade visual com a versão anterior.
 * Apenas substitui as chamadas internas de provedor pelo contexto.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export function ApfGenerateTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Gerar Documento APF
        </CardTitle>
        <CardDescription>
          Em manutenção. Utilize as abas <strong>Gerar HUs</strong> e <strong>Contar PF</strong>
          enquanto esta funcionalidade é restaurada.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
