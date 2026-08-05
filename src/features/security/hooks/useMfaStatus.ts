import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type MfaStatus = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedFactors: Factor<"totp", "verified">[];
};

const EMPTY_STATUS: MfaStatus = {
  currentLevel: null,
  nextLevel: null,
  verifiedFactors: [],
};

export function useMfaStatus() {
  const [status, setStatus] = useState<MfaStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [factorsResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    const requestError = factorsResult.error ?? assuranceResult.error;
    if (requestError) {
      setStatus(EMPTY_STATUS);
      setError("Não foi possível consultar a proteção em duas etapas.");
      setLoading(false);
      return;
    }

    setStatus({
      currentLevel: assuranceResult.data.currentLevel,
      nextLevel: assuranceResult.data.nextLevel,
      verifiedFactors: factorsResult.data.totp,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...status, loading, error, refresh };
}
