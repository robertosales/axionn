import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

export interface AutomationRule {
  id:                   string;
  name:                 string;
  enabled:              boolean;
  trigger_type:         string; // status_change
  trigger_to_status:    string;
  trigger_from_status:  string | null;
  action_type:          string; // notify | change_status
  action_target_status: string | null;
  action_message:       string | null;
  team_id:              string;
  created_at:           string;
}

export function useAutomationRules() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [rules,   setRules]   = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const { data } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at");
    setRules((data ?? []) as AutomationRule[]);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const createRule = useCallback(async (rule: Omit<AutomationRule, "id" | "team_id" | "created_at">) => {
    const { error } = await supabase.from("automation_rules").insert({ ...rule, team_id: teamId });
    if (error) { toast.error("Erro ao criar regra"); return; }
    toast.success("Regra criada!");
    await load();
  }, [teamId, load]);

  const updateRule = useCallback(async (id: string, patch: Partial<AutomationRule>) => {
    await supabase.from("automation_rules").update(patch).eq("id", id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const toggleRule = useCallback(async (id: string, enabled: boolean) => {
    await supabase.from("automation_rules").update({ enabled }).eq("id", id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
    toast.success(enabled ? "Regra ativada" : "Regra desativada");
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    await supabase.from("automation_rules").delete().eq("id", id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success("Regra removida");
  }, []);

  return { rules, loading, createRule, updateRule, toggleRule, deleteRule, reload: load };
}
