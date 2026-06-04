import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjetosComContrato,
  createProjeto,
  updateProjeto,
  deleteProjeto,
  type Projeto,
} from '../services/projetos.service';
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

  const create = useCallback(async (data: Partial<Projeto>) => {
    if (!currentTeam?.id) throw new Error('Sem time selecionado');
    const res = await createProjeto({
      team_id:     currentTeam.id,
      nome:        data.nome ?? '',
      descricao:   data.descricao ?? undefined,
      equipe:      data.equipe ?? undefined,
      sla:         data.sla ?? undefined,
      sla_id:      data.sla_id ?? null,
      contract_id: data.contract_id ?? null,
    });
    await load();
    return res;
  }, [currentTeam?.id, load]);

  const update = useCallback(async (id: string, updates: Partial<Projeto>) => {
    const res = await updateProjeto(id, updates);
    await load();
    return res;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await deleteProjeto(id);
    await load();
  }, [load]);

  return { projetos, loading, error, reload: load, create, update, remove };
}
