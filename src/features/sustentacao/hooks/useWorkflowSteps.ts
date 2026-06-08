import { useMemo } from "react";
import { ALL_SITUACOES, SITUACAO_LABELS } from "../types/demanda";

export interface WorkflowStep {
  key: string;
  label: string;
  order: number;
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

const TERMINAL_STEPS = new Set(["ag_aceite_final", "cancelada", "rejeitada"]);

export function useWorkflowSteps(): WorkflowStep[] {
  return useMemo(() => {
    return [...ALL_SITUACOES]
      .map((key) => ({
        key,
        label: SITUACAO_LABELS[key] ?? key,
        order: WORKFLOW_ORDER[key] ?? 99,
        isTerminal: TERMINAL_STEPS.has(key),
      }))
      .sort((a, b) => a.order - b.order);
  }, []);
}

export function useWorkflowStep(situacao: string): WorkflowStep | undefined {
  const steps = useWorkflowSteps();
  return steps.find((s) => s.key === situacao);
}
