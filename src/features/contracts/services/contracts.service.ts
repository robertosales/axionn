import { supabase } from '@/integrations/supabase/client';
import type { ContractFormData, SlaRow } from '../types/contract';

// ── Audit log helper ──────────────────────────────────────────────────────────
async function writeAuditLog(
  contractId: string,
  action: string,
  payload?: Record<string, unknown>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('contract_audit_log').insert({
      contract_id: contractId,
      admin_id:    user.id,
      action,
      payload:     payload ?? null,
    });
  } catch {
    // audit log nunca deve quebrar o fluxo principal
  }
}

// ── Contracts ────────────────────────────────────────────────────────────────

export async function fetchContracts() {
  const { data, error } = await (supabase as any)
    .from('contracts')
    .select('*, contract_slas(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchContractById(id: string) {
  const { data, error } = await (supabase as any)
    .from('contracts')
    .select('*, contract_slas(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createContract(form: ContractFormData) {
  const { data, error } = await (supabase as any)
    .from('contracts')
    .insert([{
      name:        form.name,
      description: form.description || null,
      status:      form.status,
      room_mode:   form.room_mode   ?? 'sustentacao',
      starts_at:   form.starts_at   || null,
      ends_at:     form.ends_at     || null,
    }])
    .select('id')
    .single();
  if (error) throw error;
  const contractId = data.id as string;
  // A — Audit log: criação
  await writeAuditLog(contractId, 'created', {
    name:      form.name,
    room_mode: form.room_mode,
    status:    form.status,
  });
  return contractId;
}

export async function updateContract(id: string, form: ContractFormData) {
  const { error } = await (supabase as any)
    .from('contracts')
    .update({
      name:        form.name,
      description: form.description || null,
      status:      form.status,
      room_mode:   form.room_mode   ?? 'sustentacao',
      starts_at:   form.starts_at   || null,
      ends_at:     form.ends_at     || null,
    })
    .eq('id', id);
  if (error) throw error;
  // A — Audit log: atualização
  await writeAuditLog(id, 'updated', {
    name:      form.name,
    room_mode: form.room_mode,
    status:    form.status,
  });
}

export async function deleteContract(id: string) {
  await writeAuditLog(id, 'deleted', {});
  const { error } = await (supabase as any).from('contracts').delete().eq('id', id);
  if (error) throw error;
}

// ── Contract SLAs ─────────────────────────────────────────────────────────────

export async function upsertContractSlas(contractId: string, slas: SlaRow[]) {
  await (supabase as any).from('contract_slas').delete().eq('contract_id', contractId);
  if (slas.length === 0) return;
  const { error } = await (supabase as any).from('contract_slas').insert(
    slas.map(s => ({ ...s, contract_id: contractId }))
  );
  if (error) throw error;
  // A — Audit log: SLA atualizado
  await writeAuditLog(contractId, 'sla_updated', {
    priorities: slas.map(s => s.priority),
  });
}

// ── C — contract_room_teams: vínculo N:N time×sala ───────────────────────────

export async function linkTeamToContract(
  contractId: string,
  teamId: string,
  roomType: 'agil' | 'sustentacao',
): Promise<void> {
  const { error } = await (supabase as any)
    .from('contract_room_teams')
    .upsert(
      { contract_id: contractId, team_id: teamId, room_type: roomType },
      { onConflict: 'contract_id,team_id,room_type' },
    );
  if (error) throw error;
  await writeAuditLog(contractId, 'team_linked', { teamId, roomType });
}

export async function unlinkTeamFromContract(
  contractId: string,
  teamId: string,
  roomType: 'agil' | 'sustentacao',
): Promise<void> {
  const { error } = await (supabase as any)
    .from('contract_room_teams')
    .delete()
    .eq('contract_id', contractId)
    .eq('team_id', teamId)
    .eq('room_type', roomType);
  if (error) throw error;
  await writeAuditLog(contractId, 'team_unlinked', { teamId, roomType });
}

export async function fetchContractRoomTeams(contractId: string) {
  const { data, error } = await (supabase as any)
    .from('contract_room_teams')
    .select('id, team_id, room_type, created_at, teams(id, name, module)')
    .eq('contract_id', contractId)
    .order('room_type');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id:        r.id,
    teamId:    r.team_id,
    roomType:  r.room_type,
    teamName:  r.teams?.name,
    teamModule: r.teams?.module,
  }));
}

// ── Listagem de contratos ativos ─────────────────────────────────────────────

export async function fetchActiveContracts(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await (supabase as any)
    .from('contracts')
    .select('id, name')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// ── Stubs de compatibilidade (HU-001) ────────────────────────────────────────
// Estes helpers existem para satisfazer hooks/components legados.
// A lógica real é coberta por RPCs no banco; aqui apenas encaminhamos.

export async function fetchFreeTeams(): Promise<{ id: string; name: string; module: string }[]> {
  const { data, error } = await (supabase as any)
    .from('teams')
    .select('id, name, module')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getTeamContract(teamId: string): Promise<any> {
  const { data, error } = await (supabase as any).rpc('fn_get_team_contract', { p_team_id: teamId });
  if (error) throw error;
  return data;
}

export async function checkSlaStatus(params: {
  demandaId:  string;
  contractId: string;
  priority:   string;
  createdAt:  string;
}): Promise<any> {
  const { data, error } = await (supabase as any).rpc('fn_check_sla_status', {
    p_demanda_id:  params.demandaId,
    p_contract_id: params.contractId,
    p_priority:    params.priority,
    p_created_at:  params.createdAt,
  });
  if (error) throw error;
  return data;
}
