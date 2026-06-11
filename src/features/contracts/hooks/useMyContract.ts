import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Contract, ContractSla, ContractRoomTeam } from '../types/contract';

export interface MyContractData {
  contract:   Contract;
  slas:       ContractSla[];
  roomTeams:  ContractRoomTeam[];
}

/**
 * Retorna o contrato vinculado ao usuário autenticado via user_contracts.
 * Usado exclusivamente pelo perfil admin_contrato.
 */
export function useMyContract() {
  const [data,    setData]    = useState<MyContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Busca o vínculo user → contract
      const { data: link, error: linkErr } = await (supabase as any)
        .from('user_contracts')
        .select('contract_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (linkErr) throw linkErr;
      if (!link?.contract_id) {
        setData(null);
        return;
      }

      const contractId = link.contract_id as string;

      // 2. Carrega contrato + SLAs
      const { data: contract, error: contractErr } = await (supabase as any)
        .from('contracts')
        .select('*, contract_slas(*)')
        .eq('id', contractId)
        .single();

      if (contractErr) throw contractErr;

      // 3. Carrega times vinculados
      const { data: roomTeams, error: teamsErr } = await (supabase as any)
        .from('contract_room_teams')
        .select('id, team_id, room_type, created_at, teams(id, name, module)')
        .eq('contract_id', contractId)
        .order('room_type');

      if (teamsErr) throw teamsErr;

      const mappedTeams: ContractRoomTeam[] = (roomTeams ?? []).map((r: any) => ({
        id:          r.id,
        contract_id: contractId,
        team_id:     r.team_id,
        room_type:   r.room_type,
        created_at:  r.created_at,
        team_name:   r.teams?.name,
        team_module: r.teams?.module,
      }));

      setData({
        contract:  contract as Contract,
        slas:      (contract.contract_slas ?? []) as ContractSla[],
        roomTeams: mappedTeams,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
