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

  // Realtime debounce
  useEffect(() => {
    if (!currentTeamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`transitions-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda_transitions' },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            qc.invalidateQueries({ queryKey: KEYS.demandas.allTransitions(currentTeamId) });
          }, 2000);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, qc]);

  return { transitions: data || [], loading, reload: refetch };
}

export function useAllHours() {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();

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

  // Realtime debounce
  useEffect(() => {
    if (!currentTeamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`hours-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda_hours' },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            qc.invalidateQueries({ queryKey: KEYS.demandas.allHours(currentTeamId) });
          }, 2000);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, qc]);

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
    staleTime: STALE.SESSION, // Profiles change rarely
  });

  return data || [];
}
