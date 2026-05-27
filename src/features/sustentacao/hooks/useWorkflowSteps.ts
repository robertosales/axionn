import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
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

export function nomeToKey(nome: string): string {
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

  useEffect(() => {
    const sub = supabase.channel("workflow-steps-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sustentacao_workflow_steps" },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [qc]);

  return { steps, loading, reload: () => qc.invalidateQueries({ queryKey }), buildDefaultSteps };
}
