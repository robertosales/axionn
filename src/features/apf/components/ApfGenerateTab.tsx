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
export { ApfGenerateTab } from "./ApfGenerateTab.original";
