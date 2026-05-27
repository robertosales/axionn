import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as svc from "../services/projetos.service";
import type { Projeto } from "../services/projetos.service";
import { KEYS } from "@/lib/queryKeys";
import { STALE } from "@/lib/queryClient";
import { useEffect } from "react";

/**
 * allTeams=true → busca projetos de TODOS os times (usado no form de edição).
 */
export function useProjetos(options?: { allTeams?: boolean }) {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();
  const allTeams = options?.allTeams ?? false;

  const queryKey = allTeams ? ['projetos', 'all'] : KEYS.projetos(currentTeamId ?? '');

  const { data: projetos = [], isLoading: loading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (allTeams) {
        const { data, error: err } = await supabase.from("projetos").select("*").order("nome");
        if (err) throw err;
        return data as unknown as Projeto[];
      }
      return svc.fetchProjetos(currentTeamId!);
    },
    enabled: allTeams || !!currentTeamId,
    staleTime: STALE.REFERENCE, // Projetos mudam raramente
  });

  // Realtime
  useEffect(() => {
    if (!allTeams && !currentTeamId) return;
    const filter = allTeams ? undefined : `team_id=eq.${currentTeamId}`;

    const sub = supabase.channel(allTeams ? "projetos-rt-all" : `projetos-rt-${currentTeamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projetos", ...(filter ? { filter } : {}) },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [currentTeamId, allTeams, qc, queryKey]);

  const createMutation = useMutation({
    mutationFn: (p: { nome: string; descricao?: string; equipe?: string; sla?: string }) =>
      svc.createProjeto({ ...p, team_id: currentTeamId! }),
    onSuccess: () => {
      toast.success("Projeto criado");
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erro ao criar projeto")
  });

  return {
    projetos,
    loading,
    error: error ? (error as Error).message : null,
    create: createMutation.mutateAsync,
    reload: () => qc.invalidateQueries({ queryKey })
  };
}
