import { supabase } from '@/integrations/supabase/client';
import type {
  Contract,
  ContractFormData,
  ContractSla,
  SlaRow,
  SlaStatusResult,
} from '../types/contract';

// ── Contratos ─────────────────────────────────────────────────────────────────

export async function fetchContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, contract_slas(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Contract[];
}

export async function fetchContractById(id: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, contract_slas(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Contract;
}

export async function createContract(payload: ContractFormData): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({ ...payload })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Contract;
}

export async function updateContract(
  id: string,
  payload: Partial<ContractFormData>
): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id);
  if (error) throw error;
}

// ── SLAs ──────────────────────────────────────────────────────────────────────

export async function upsertContractSlas(
  contractId: string,
  slas: SlaRow[]
): Promise<void> {
  const rows = slas.map((s) => ({ ...s, contract_id: contractId }));
  const { error } = await supabase
    .from('contract_slas')
    .upsert(rows, { onConflict: 'contract_id,priority' });
  if (error) throw error;
}

export async function fetchSlasByContract(contractId: string): Promise<ContractSla[]> {
  const { data, error } = await supabase
    .from('contract_slas')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as unknown as ContractSla[];
}

// ── Vínculo de Teams ──────────────────────────────────────────────────────────

export async function linkTeamToContract(
  teamId: string,
  contractId: string,
  teamType: 'agile' | 'sustenance'
): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ contract_id: contractId, team_type: teamType })
    .eq('id', teamId);
  if (error) throw error;
}

export async function unlinkTeamFromContract(teamId: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ contract_id: null })
    .eq('id', teamId);
  if (error) throw error;
}

export async function fetchFreeTeams(): Promise<{ id: string; name: string; module: string }[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, module')
    .is('contract_id', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeamsByContract(
  contractId: string
): Promise<{ id: string; name: string; team_type: string | null }[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, team_type')
    .eq('contract_id', contractId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── RPC: Status de SLA de um chamado ─────────────────────────────────────────

export async function checkSlaStatus(params: {
  demandaId: string;
  contractId: string;
  priority: string;
  createdAt: string;
}): Promise<SlaStatusResult> {
  const { data, error } = await supabase.rpc('fn_check_sla_status', {
    p_demanda_id:  params.demandaId,
    p_contract_id: params.contractId,
    p_priority:    params.priority,
    p_created_at:  params.createdAt,
    p_now:         new Date().toISOString(),
  });
  if (error) throw error;
  return data as SlaStatusResult;
}

// ── RPC: Contrato de um team ──────────────────────────────────────────────────

export async function getTeamContract(teamId: string): Promise<{
  contract_id: string;
  contract_name: string;
  contract_status: string;
  team_type: string;
  slas: ContractSla[];
} | null> {
  const { data, error } = await supabase.rpc('fn_get_team_contract', {
    p_team_id: teamId,
  });
  if (error) throw error;
  if (data?.status === 'no_contract_linked') return null;
  return data;
}
