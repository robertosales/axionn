// src/features/retro/utils/retroModels.ts
import type { RetroColumn, RetroModelKey, RetroPhase } from "../types/retro";

export const RETRO_MODELS: Record<RetroModelKey, { label: string; columns: RetroColumn[] }> = {
  "4ls": {
    label: "4Ls",
    columns: [
      { key: "liked", label: "Gostamos", icon: "👍", desc: "O que gostamos", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
      { key: "learned", label: "Aprendemos", icon: "📚", desc: "O que aprendemos", color: "text-info", bg: "bg-info/10", border: "border-info/30" },
      { key: "lacked", label: "Faltou", icon: "😕", desc: "O que faltou", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
      { key: "longed_for", label: "Desejamos", icon: "⚡", desc: "O que desejamos", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    ],
  },
  start_stop_continue: {
    label: "Iniciar / Parar / Continuar",
    columns: [
      { key: "start", label: "Iniciar", icon: "🟢", desc: "Começar a fazer", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
      { key: "stop", label: "Parar", icon: "🔴", desc: "Parar de fazer", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
      { key: "continue", label: "Continuar", icon: "🔵", desc: "Continuar fazendo", color: "text-info", bg: "bg-info/10", border: "border-info/30" },
    ],
  },
  mad_sad_glad: {
    label: "Frustrado / Triste / Feliz",
    columns: [
      { key: "mad", label: "Frustrado", icon: "😡", desc: "Nos irritou", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
      { key: "sad", label: "Triste", icon: "😢", desc: "Nos entristeceu", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
      { key: "glad", label: "Feliz", icon: "😊", desc: "Nos alegrou", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
    ],
  },
  starfish: {
    label: "Estrela do Mar",
    columns: [
      { key: "keep", label: "Manter", icon: "✅", desc: "Manter fazendo", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
      { key: "less", label: "Menos", icon: "↘️", desc: "Fazer menos", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
      { key: "more", label: "Mais", icon: "↗️", desc: "Fazer mais", color: "text-info", bg: "bg-info/10", border: "border-info/30" },
      { key: "stop", label: "Parar", icon: "🛑", desc: "Parar de fazer", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
      { key: "start", label: "Iniciar", icon: "🚀", desc: "Começar a fazer", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
    ],
  },
  kpt: {
    label: "KPT (Keep / Problem / Try)",
    columns: [
      { key: "keep", label: "Keep", icon: "✅", desc: "Manter", color: "text-success", bg: "bg-success/10", border: "border-success/30" },
      { key: "problem", label: "Problem", icon: "⚠️", desc: "Problemas", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
      { key: "try", label: "Try", icon: "💡", desc: "Tentar", color: "text-info", bg: "bg-info/10", border: "border-info/30" },
    ],
  },
};

export function getModel(key: RetroModelKey) {
  return RETRO_MODELS[key] ?? RETRO_MODELS["4ls"];
}

export const RETRO_PHASE_LABELS: Record<RetroPhase, string> = {
  writing: "1. Escrita",
  reveal: "2. Revelação",
  voting: "3. Votação",
  action_items: "4. Action Items",
  closed: "5. Encerrada",
};

export const RETRO_PHASE_ORDER: RetroPhase[] = ["writing", "reveal", "voting", "action_items", "closed"];
