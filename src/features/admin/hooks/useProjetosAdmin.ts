import { useCallback, useEffect, useState } from 'react';
import {
  createProjetoAdmin,
  updateProjetoAdmin,
  archiveProjetoAdmin,
  type ProjetoAdmin,
} from '../services/projects.service';
import { supabase } from '@/integrations/supabase/client';

/**
 * contractId: quando fornecido, retorna apenas projetos desse contrato.
 * null/undefined = todos os projetos.
 */
export function useProjetosAdmin(contractId?: string | null) {
  const [projetos, setProjetos] = useState<ProjetoAdmin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Busca projetos SEM o join de teams para evitar o erro de relação ambígua
      let query = (supabase as any)
        .from('projects')
        .select(`
          id, name, description, code, status, module_type,
          contract_id, team_id, redmine_id, legacy_projetos_id,
          contracts(name)
        `)
        .neq('status', 'archived')
        .order('name');

      if (contractId) query = query.eq('contract_id', contractId);

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data ?? []) as any[];

      // Busca nomes dos times em lote separado
      const teamIds = [...new Set(rows.map((p: any) => p.team_id).filter(Boolean))] as string[];
      let teamMap: Record<string, string> = {};
      if (teamIds.length > 0) {
        const { data: teamsData } = await (supabase as any)
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        (teamsData ?? []).forEach((t: any) => { teamMap[t.id] = t.name; });
      }

      setProjetos(rows.map((p: any) => ({
        id:                 p.id,
        name:               p.name,
        description:        p.description,
        code:               p.code,
        status:             p.status,
        module_type:        p.module_type,
        contract_id:        p.contract_id,
        contract_name:      p.contracts?.name ?? null,
        team_id:            p.team_id,
        team_name:          teamMap[p.team_id] ?? null,
        redmine_id:         p.redmine_id,
        legacy_projetos_id: p.legacy_projetos_id,
        created_at:         p.created_at,
        updated_at:         p.updated_at,
        sla_id:             p.sla_id ?? null,
      })));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const create  = (payload: any) => createProjetoAdmin(payload).then(() => load());
  const update  = (id: string, payload: any) => updateProjetoAdmin(id, payload).then(() => load());
  const archive = (id: string) => archiveProjetoAdmin(id).then(() => load());

  return { projetos, loading, error, reload: load, create, update, archive };
}
