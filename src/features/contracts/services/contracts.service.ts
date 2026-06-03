import { supabase } from '@/integrations/supabase/client';
import type { ContractFormData, SlaRow } from '../types/contract';

// ── Contracts ────────────────────────────────────────────────────────────────

export async function fetchContracts() {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, contract_slas(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchContractById(id: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, contract_slas(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createContract(form: ContractFormData) {
  const { data, error } = await supabase
    .from('contracts')
    .insert([{
      name:        form.name,
      description: form.description || null,
      status:      form.status,
      starts_at:   form.starts_at   || null,
      ends_at:     form.ends_at     || null,
    }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateContract(id: string, form: ContractFormData) {
  const { error } = await supabase
    .from('contracts')
    .update({
      name:        form.name,
      description: form.description || null,
      status:      form.status,
      starts_at:   form.starts_at   || null,
      ends_at:     form.ends_at     || null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteContract(id: string) {
  const { error } = await supabase.from('contracts').delete().eq('id', id);
  if (error) throw error;
}

// ── Contract SLAs ─────────────────────────────────────────────────────────────

export async function upsertContractSlas(contractId: string, slas: SlaRow[]) {
  // Limpa os SLAs anteriores e reinserere os novos
  await supabase.from('contract_slas').delete().eq('contract_id', contractId);
  if (slas.length === 0) return;
  const { error } = await supabase.from('contract_slas').insert(
    slas.map(s => ({ ...s, contract_id: contractId }))
  );
  if (error) throw error;
}

// ── Listagem de contratos ativos (para selects em Projetos) ─────────────────

export async function fetchActiveContracts(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, name')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return data ?? [];
}
