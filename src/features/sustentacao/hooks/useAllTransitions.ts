/**
 * useAllTransitions / useAllHours / useProfiles
 *
 * PERF sust-01:
 * - Canais Realtime de transitions e hours REMOVIDOS.
 *   Invalidação já é coberta pelo canal do useDemandas (mesma tabela
 *   raiz, mesmo debounce 2s). Cada canal a menos = -2 conexões RT
 *   por usuário → -300 canais com 150 usuários simultâneos.
 * - Queries mantidas com staleTime REALTIME (30s).
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KEYS } from "@/lib/queryKeys";
import { STALE } from "@/lib/queryClient";
import type { DemandaTransition, DemandaHour } from "../types/demanda";

export function useAllTransitions() {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: KEYS.demandas.allTransitions(currentTeamId ?? ""),
    queryFn: async () => {
      if (!currentTeamId) return [];
      const { data, error } = await supabase
        .from("demanda_transitions" as any)
        .select("*, demandas!inner(team_id)")
        .eq("demandas.team_id", currentTeamId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as DemandaTransition[];
    },
    enabled: !!currentTeamId,
    staleTime: STALE.REALTIME,
  });

  // Realtime removido: invalidação coberta pelo canal do useDemandas
  // (demandas → debounce 2s → invalida KEYS.demandas.all → downstream)
  // Isso elimina 2 canais RT por usuário (~300 canais a menos com 150 users)
  useEffect(() => {
    if (!currentTeamId) return;
    // Invalida junto quando demandas mudam (via evento do useDemandas)
    // Sem canal próprio: useDemandas já escuta a tabela demandas com filtro
    // e propaga invalidação. Transitions e hours são dados dependentes.
  }, [currentTeamId, qc]);

  return { transitions: data || [], loading, reload: refetch };
}

export function useAllHours() {
  const { currentTeamId } = useAuth();

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: KEYS.demandas.allHours(currentTeamId ?? ""),
    queryFn: async () => {
      if (!currentTeamId) return [];
      const { data, error } = await supabase
        .from("demanda_hours" as any)
        .select("*, demandas!inner(team_id)")
        .eq("demandas.team_id", currentTeamId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as DemandaHour[];
    },
    enabled: !!currentTeamId,
    staleTime: STALE.REALTIME,
  });

  // Realtime removido: mesmo motivo do useAllTransitions
  return { hours: data || [], loading, reload: refetch };
}

export function useProfiles() {
  const { data } = useQuery({
    queryKey: KEYS.profiles.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as Array<{ user_id: string; display_name: string; email: string }>;
    },
    staleTime: STALE.SESSION,
  });

  return data || [];
}
