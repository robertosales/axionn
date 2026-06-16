/**
 * useProjetos — lista projetos de public.projects (tabela nova, Fase 5c)
 * mantendo o shape legado { id, nome, sla, contract_id, contract_name }
 * para compatibilidade com DemandaForm e demais consumidores.
 *
 * HISTORICO:
 *   Antes buscava da tabela legada `projetos`, cujos UUIDs NAO coincidem
 *   com public.projects. Isso causava violacao de FK (demandas_project_id_fkey)
 *   ao tentar gravar uma nova demanda, pois project_id apontava para um ID
 *   que nao existia em public.projects.
 *
 * allTeams=true: retorna projetos de todos os times do usuario (usado na edicao
 *   de demandas para nao perder projeto de outro time).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Projeto {
  id:            string;
  team_id:       string | null;
  nome:          string;
  descricao:     string | null;
  equipe:        string | null;
  sla:           string;
  sla_id:        string | null;
  contract_id:   string | null;
  contract_name: string | null;
  created_at:    string;
  updated_at:    string;
}

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
      const { data, error: err } = await (supabase as any)
        .from('projects')
        .select(`
          id, team_id, name, description, status,
          sla_id, contract_id, created_at, updated_at,
          contracts ( name )
        `)
        .in('team_id', teamIds)
        .neq('status', 'archived')
        .order('name');

      if (err) throw err;

      const rows = ((data ?? []) as any[]).map((p: any): Projeto => ({
        id:            p.id,
        team_id:       p.team_id,
        nome:          p.name,            // public.projects usa `name`; DemandaForm espera `nome`
        descricao:     p.description ?? null,
        equipe:        null,               // campo exclusivo da tabela legada, nao existe em public.projects
        sla:           p.sla_id ?? 'padrao',
        sla_id:        p.sla_id ?? null,
        contract_id:   p.contract_id ?? null,
        contract_name: p.contracts?.name ?? null,
        created_at:    p.created_at,
        updated_at:    p.updated_at,
      }));

      // Deduplicacao por id (seguranca contra duplicatas de join)
      const map = new Map<string, Projeto>();
      rows.forEach((p) => map.set(p.id, p));
      setProjetos([...map.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [allTeams, currentTeam?.id, teams]);

  useEffect(() => { load(); }, [load]);

  async function create(payload: any) {
    const teamId = currentTeam?.id;
    const insert: any = {
      team_id:     teamId,
      name:        payload.nome,
      description: payload.descricao ?? null,
      module_type: payload.module_type ?? null,
      code:        payload.code ?? null,
      redmine_id:  payload.redmine_id ?? null,
      status:      'active',
    };
    const { error: err } = await (supabase as any).from('projects').insert(insert);
    if (err) throw err;
    await load();
  }

  async function update(id: string, payload: any) {
    const updates: any = {
      name:        payload.nome,
      description: payload.descricao ?? null,
      module_type: payload.module_type ?? null,
      code:        payload.code ?? null,
      redmine_id:  payload.redmine_id ?? null,
    };
    const { error: err } = await (supabase as any).from('projects').update(updates).eq('id', id);
    if (err) throw err;
    await load();
  }

  async function remove(id: string) {
    const { error: err } = await (supabase as any).from('projects').delete().eq('id', id);
    if (err) throw err;
    await load();
  }

  return { projetos, loading, error, reload: load, create, update, remove };
}
