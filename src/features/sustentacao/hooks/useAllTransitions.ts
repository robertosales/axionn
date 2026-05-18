import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DemandaTransition, DemandaHour } from "../types/demanda";

export function useAllTransitions() {
  const { currentTeamId } = useAuth();
  const [transitions, setTransitions] = useState<DemandaTransition[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentTeamId) return;
    setLoading(true);
    try {
      // OTIMIZAÇÃO: 1 única query usando inner join para filtrar por team_id
      // (evita o round-trip extra para buscar IDs de demandas antes)
      const { data } = await supabase
        .from("demanda_transitions" as any)
        .select("*, demandas!inner(team_id)")
        .eq("demandas.team_id", currentTeamId)
        .order("created_at", { ascending: true });
      setTransitions((data || []) as unknown as DemandaTransition[]);
    } catch {
      setTransitions([]);
    } finally {
      setLoading(false);
    }
  }, [currentTeamId]);

  useEffect(() => { load(); }, [load]);
  return { transitions, loading, reload: load };
}

export function useAllHours() {
  const { currentTeamId } = useAuth();
  const [hours, setHours] = useState<DemandaHour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentTeamId) return;
    setLoading(true);
    try {
      // OTIMIZAÇÃO: 1 única query com inner join (evita N+1 / round-trip extra)
      const { data } = await supabase
        .from("demanda_hours" as any)
        .select("*, demandas!inner(team_id)")
        .eq("demandas.team_id", currentTeamId)
        .order("created_at", { ascending: true });
      setHours((data || []) as unknown as DemandaHour[]);
    } catch {
      setHours([]);
    } finally {
      setLoading(false);
    }
  }, [currentTeamId]);

  useEffect(() => { load(); }, [load]);
  return { hours, loading, reload: load };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Array<{ user_id: string; display_name: string; email: string }>>([]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, display_name, email").then(({ data }) => {
      setProfiles((data || []) as any[]);
    });
  }, []);

  return profiles;
}
