import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "axion_onboarding_done";

export function useOnboarding() {
  const { user, profile, loading } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [persisting, setPersisting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // 1º checar localStorage (rápido, evita flash)
    const localDone = localStorage.getItem(LS_KEY) === user.id;
    if (localDone) return;
    // 2º checar profile (fonte de verdade)
    if (profile && (profile as any).onboarding_completed) {
      localStorage.setItem(LS_KEY, user.id);
      return;
    }
    // Novo usuário ou onboarding não concluído
    setShowWizard(true);
  }, [loading, user, profile]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    setPersisting(true);
    try {
      localStorage.setItem(LS_KEY, user.id);
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("user_id", user.id);
    } catch {
      // falha silenciosa — localStorage garante que não reabre
    } finally {
      setPersisting(false);
      setShowWizard(false);
    }
  }, [user]);

  const resetOnboarding = useCallback(async () => {
    if (!user) return;
    localStorage.removeItem(LS_KEY);
    await supabase
      .from("profiles")
      .update({ onboarding_completed: false } as any)
      .eq("user_id", user.id);
    setShowWizard(true);
  }, [user]);

  return { showWizard, completeOnboarding, resetOnboarding, persisting };
}
