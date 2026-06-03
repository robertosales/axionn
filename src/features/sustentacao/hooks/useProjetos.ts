import { useState, useEffect, useCallback } from 'react';
import { fetchProjetosComContrato, type Projeto } from '../services/projetos.service';
import { useAuth } from '@/contexts/AuthContext';

interface Options {
  /** true = busca projetos de todos os times do usuario; false (padrao) = apenas time atual */
  allTeams?: boolean;
}

export function useProjetos({ allTeams = false }: Options = {}) {
  const { currentTeam, teams } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    const teamIds = allTeams
      ? teams.map((t) => t.id)
      : currentTeam?.id ? [currentTeam.id] : [];

    if (teamIds.length === 0) { setProjetos([]); return; }
    setLoading(true);
    setError(null);
    try {
      // fetchProjetosComContrato ja carrega contract_name via join
      const results = await Promise.all(teamIds.map((id) => fetchProjetosComContrato(id)));
      const map = new Map<string, Projeto>();
      results.flat().forEach((p) => map.set(p.id, p));
      setProjetos([...map.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [allTeams, currentTeam?.id, teams]);

  useEffect(() => { load(); }, [load]);

  return { projetos, loading, error, reload: load };
}
