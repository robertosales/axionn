import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { STALE } from "@/lib/queryClient";

export interface DemandaFase {
  id: string;
  key: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

const FALLBACK: DemandaFase[] = [
  { id: "f1", key: "analise", label: "Análise", ordem: 1, ativo: true },
  { id: "f2", key: "planejamento", label: "Planejamento", ordem: 2, ativo: true },
  { id: "f3", key: "execucao", label: "Execução", ordem: 3, ativo: true },
  { id: "f4", key: "homologacao", label: "Homologação", ordem: 4, ativo: true },
  { id: "f5", key: "producao", label: "Produção", ordem: 5, ativo: true },
  { id: "f6", key: "reuniao_interna", label: "Reunião Interna", ordem: 6, ativo: true },
  { id: "f7", key: "reuniao_cliente", label: "Reunião Cliente", ordem: 7, ativo: true },
];

export function useFases() {
  const qc = useQueryClient();
  const queryKey = ['fases'];

  const { data: fases = FALLBACK, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demanda_fases")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data && data.length > 0) ? (data as unknown as DemandaFase[]) : FALLBACK;
    },
    staleTime: STALE.REFERENCE,
  });

  useEffect(() => {
    const sub = supabase.channel("demanda-fases-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "demanda_fases" },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [qc]);

  const reload = () => qc.invalidateQueries({ queryKey });

  async function create(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const maxOrdem = fases.reduce((m, f) => Math.max(m, f.ordem ?? 0), 0);
    const { error } = await (supabase as any).from("demanda_fases").insert({
      key, label: trimmed, ordem: maxOrdem + 1, ativo: true,
    });
    if (error) throw error;
    await reload();
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("demanda_fases").delete().eq("id", id);
    if (error) throw error;
    await reload();
  }

  return { fases, loading, reload, create, remove };
}
