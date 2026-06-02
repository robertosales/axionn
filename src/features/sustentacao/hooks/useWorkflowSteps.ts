/**
 * useWorkflowSteps — hook puro de leitura, sem canal Realtime.
 *
 * O canal RT 'workflow-steps-rt' é criado UMA única vez por usuário
 * em SustentacaoPage (useEffect no componente raiz). Isso garante
 * exatamente 1 canal independente de quantos componentes chamem
 * useWorkflowSteps() simultaneamente (Board + editor de fluxo).
 *
 * Regra da refatoração P0 preservada:
 *   150 usuários = 150 canais 'workflow-steps-rt' (1 por usuário).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_SITUACOES, SITUACAO_LABELS } from "../types/demanda";
import { STALE } from "@/lib/queryClient";

export interface WorkflowStep {
  id?: string;
  key: string;
  label: string;
  hex: string;
  ordem: number;
}

const SITUACAO_HEX: Record<string, string> = {
  nova: "#3b82f6", planejamento: "#6366f1", envio_aprovacao: "#a855f7",
  planejamento_aprovado: "#8b5cf6", execucao_dev: "#eab308", bloqueada: "#ef4444",
  aguardando_retorno: "#f97316", teste: "#06b6d4", aguardando_homologacao: "#f59e0b",
  homologada: "#10b981", fila_producao: "#14b8a6", producao: "#22c55e", aceite_final: "#84cc16",
};

/**
 * Lookup reverso: se o label corresponde a um status padrão em SITUACAO_LABELS,
 * retorna a key canônica original (ex: "fila_atendimento") em vez do slug
 * derivado do nome (que seria "fila_de_atendimento" e nunca casaria com
 * demanda.situacao). Para etapas customizadas sem correspondência, gera
 * slug simples.
 */
const LABEL_TO_KEY: Record<string, string> = {};
ALL_SITUACOES.forEach((key) => {
  const label = SITUACAO_LABELS[key];
  if (label) LABEL_TO_KEY[label.toLowerCase().trim()] = key;
});

export function nomeToKey(nome: string): string {
  const normalized = nome.toLowerCase().trim();
  if (LABEL_TO_KEY[normalized]) return LABEL_TO_KEY[normalized];
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function buildDefaultSteps(): WorkflowStep[] {
  return ALL_SITUACOES.map((sit, idx) => ({
    key: sit,
    label: SITUACAO_LABELS[sit] || sit,
    hex: SITUACAO_HEX[sit] || "#3b82f6",
    ordem: idx,
  }));
}

/** Hook puro: apenas leitura via TanStack Query. Sem canal RT. */
export function useWorkflowSteps() {
  const qc = useQueryClient();
  const queryKey = ['workflow-steps'];

  const { data: steps = buildDefaultSteps(), isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sustentacao_workflow_steps")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      if (data && data.length > 0) {
        const seen = new Set<string>();
        return data
          .map((d: any) => ({
            id: d.id,
            key: nomeToKey(d.nome),
            label: d.nome,
            hex: d.cor,
            ordem: d.ordem,
          }))
          .filter((s) => {
            if (seen.has(s.key)) return false;
            seen.add(s.key);
            return true;
          });
      }
      return buildDefaultSteps();
    },
    staleTime: STALE.REFERENCE,
  });

  return { steps, loading, reload: () => qc.invalidateQueries({ queryKey }), buildDefaultSteps };
}
