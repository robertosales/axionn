import { useQuery } from "@tanstack/react-query";
import { ALL_SITUACOES, SITUACAO_LABELS } from "../types/demanda";
import { fetchActiveWorkflowSteps } from "../services/workflowSteps.service";

export interface WorkflowStep {
  key: string;
  label: string;
  order: number;
  hex?: string;
  isTerminal?: boolean;
}

const WORKFLOW_ORDER: Record<string, number> = {
  fila_atendimento: 1,
  planejamento_elaboracao: 2,
  planejamento_ag_aprovacao: 3,
  planejamento_aprovada: 4,
  em_execucao: 5,
  bloqueada: 6,
  hom_ag_homologacao: 7,
  hom_homologada: 8,
  fila_producao: 9,
  ag_aceite_final: 10,
  fila_concluida: 11,
  rejeitada: 12,
  cancelada: 13,
};

const TERMINAL_KEYS = new Set(["ag_aceite_final", "cancelada", "rejeitada", "fila_concluida"]);

// Mapeia label (do DB) → key canônico. Permite que etapas padrão salvas
// como "Em Execução" voltem ao key "em_execucao".
const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SITUACAO_LABELS).map(([k, v]) => [v.trim().toLowerCase(), k])
);

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isTerminalLabel(key: string, label: string): boolean {
  if (TERMINAL_KEYS.has(key)) return true;
  const l = label.toLowerCase();
  return l.startsWith("cancelad") || l.startsWith("rejeitad") || l.includes("aceite final") || l.includes("concluíd") || l.includes("concluid");
}

function buildDefaultSteps(): WorkflowStep[] {
  return [...ALL_SITUACOES]
    .map((key) => ({
      key,
      label: SITUACAO_LABELS[key] ?? key,
      order: WORKFLOW_ORDER[key] ?? 99,
      isTerminal: TERMINAL_KEYS.has(key),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Hook canônico de etapas do fluxo de Sustentação.
 * Lê de `sustentacao_workflow_steps` (configurável pelo usuário) e cai
 * para o conjunto estático ALL_SITUACOES quando a tabela está vazia.
 */
export function useWorkflowSteps(): WorkflowStep[] {
  const { data } = useQuery({
    queryKey: ["workflow-steps"],
    queryFn: fetchActiveWorkflowSteps,
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return buildDefaultSteps();

  // Garante unicidade de `key` para que nenhuma etapa seja descartada por
  // colisão de chave (React `key` collision oculta o item silenciosamente).
  const usedKeys = new Set<string>();
  return [...data]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((row, idx) => {
      const label = (row.nome ?? "").trim();
      const baseKey = LABEL_TO_KEY[label.toLowerCase()] ?? slugify(label) ?? `step_${idx}`;
      let key = baseKey || `step_${idx}`;
      let suffix = 2;
      while (usedKeys.has(key)) {
        key = `${baseKey}_${suffix++}`;
      }
      usedKeys.add(key);
      return {
        key,
        label,
        order: row.ordem ?? idx,
        hex: row.cor,
        isTerminal: isTerminalLabel(key, label),
      };
    });
}

export function useWorkflowStep(situacao: string): WorkflowStep | undefined {
  const steps = useWorkflowSteps();
  return steps.find((s) => s.key === situacao);
}
