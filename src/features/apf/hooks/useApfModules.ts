import { useState, useEffect } from "react";
import { fetchModules, type ApfModule } from "../services/apf.service";

/**
 * Hook simples para carregar os módulos APF cadastrados na tabela apf_modules.
 * Usado no modal de template para popular o select de Módulo.
 */
export function useApfModules() {
  const [modules, setModules] = useState<ApfModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules()
      .then(setModules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { modules, loading };
}
