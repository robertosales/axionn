/**
 * useProjetosAdmin
 * Fase 5c: hook para gestão de projetos no painel Admin.
 * Lê de public.projects (nova tabela).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjetosAdmin,
  createProjetoAdmin,
  updateProjetoAdmin,
  archiveProjetoAdmin,
  type ProjetoAdmin,
} from '../services/projects.service';

export function useProjetosAdmin() {
  const [projetos, setProjetos] = useState<ProjetoAdmin[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjetos(await fetchProjetosAdmin());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (
    payload: Parameters<typeof createProjetoAdmin>[0],
  ) => {
    const res = await createProjetoAdmin(payload);
    await load();
    return res;
  }, [load]);

  const update = useCallback(async (
    id: string,
    updates: Partial<ProjetoAdmin>,
  ) => {
    const res = await updateProjetoAdmin(id, updates);
    await load();
    return res;
  }, [load]);

  const archive = useCallback(async (id: string) => {
    await archiveProjetoAdmin(id);
    await load();
  }, [load]);

  return { projetos, loading, error, reload: load, create, update, archive };
}
