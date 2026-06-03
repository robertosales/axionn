import { useEffect, useState } from "react";
import {
  getDemandasWithResponsaveis,
  DemandaWithProjeto,
} from "@/integrations/demandas";

export function useDemandasWithResponsaveis(teamId: string | null) {
  const [data, setData] = useState<DemandaWithProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDemandasWithResponsaveis(teamId!);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { data, loading, error };
}
