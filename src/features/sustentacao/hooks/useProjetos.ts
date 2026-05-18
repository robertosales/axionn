import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as svc from "../services/projetos.service";
import type { Projeto } from "../services/projetos.service";

/**
 * allTeams=true → busca projetos de TODOS os times (usado no form de edição
 * para não perder o projeto quando o time ativo é diferente do time da demanda).
 */
export function useProjetos(options?: { allTeams?: boolean }) {
  const { currentTeamId } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allTeams = options?.allTeams ?? false;

  const load = useCallback(async () => {
    if (!allTeams && !currentTeamId) return;
    setLoading(true);
    setError(null);
    try {
      let data: Projeto[];
      if (allTeams) {
        // Busca todos os projetos sem filtrar por time
        const { data: rows, error: err } = await supabase
          .from("projetos" as any)
          .select("*")
          .order("nome");
        if (err) throw err;
        data = (rows || []) as unknown as Projeto[];
      } else {
        data = await svc.fetchProjetos(currentTeamId!);
      }
      setProjetos(data);
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, allTeams]);

  useEffect(() => { load(); }, [load]);

  // Realtime — escuta qualquer mudança na tabela projetos
  useEffect(() => {
    const channelName = allTeams ? "projetos-rt-all" : `projetos-rt-${currentTeamId}`;
    const filter = allTeams ? undefined : `team_id=eq.${currentTeamId}`;
    if (!allTeams && !currentTeamId) return;

    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "projetos", ...(filter ? { filter } : {}) },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [currentTeamId, allTeams, load]);

  const create = async (p: { nome: string; descricao?: string; equipe?: string; sla?: string }) => {
    if (!currentTeamId) return;
    try {
      await svc.createProjeto({ ...p, team_id: currentTeamId });
      toast.success("Projeto criado com sucesso");
    } catch {
      toast.error("Erro ao criar projeto");
    }
  };

  const update = async (id: string, updates: Partial<Projeto>) => {
    try {
      await svc.updateProjeto(id, updates);
      toast.success("Projeto atualizado com sucesso");
    } catch {
      toast.error("Erro ao atualizar projeto");
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteProjeto(id);
      toast.success("Projeto excluído com sucesso");
    } catch {
      toast.error("Erro ao excluir projeto");
    }
  };

  return { projetos, loading, error, reload: load, create, update, remove };
}
