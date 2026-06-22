import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date:   string | null;
  company_id: string | null;
  number:          string | null;
  object:          string | null;
  value_per_pfus:  number | null;
  currency:        string | null;
  projectCount?: number;
  slaCount?:     number;
}

export interface ContractFormData {
  name:       string;
  status:     string;
  start_date: string;
  end_date:   string;
  company_id: string | null;
  number:         string;
  object:         string;
  value_per_pfus: string;   // string no form, parseFloat antes de persistir
  currency:       string;
  // Relações
  team_ids:    string[];
  project_ids: string[];
  sla_ids:     string[];
}

export const EMPTY_CONTRACT_FORM: ContractFormData = {
  name:           '',
  status:         'active',
  start_date:     '',
  end_date:       '',
  company_id:     null,
  number:         '',
  object:         '',
  value_per_pfus: '',
  currency:       'BRL',
  team_ids:    [],
  project_ids: [],
  sla_ids:     [],
};

export interface ContractKpis {
  total:    number;
  active:   number;
  paused:   number;
  critical: number;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [kpis,      setKpis]      = useState<ContractKpis>({ total: 0, active: 0, paused: 0, critical: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('contracts')
        .select(`
          id, name, status, start_date, end_date,
          company_id, number, object, value_per_pfus, currency,
          projects:projects(id),
          contract_slas:contract_slas(id)
        `)
        .order('name', { ascending: true });

      const list: Contract[] = (data || []).map((c: any) => ({
        id:             c.id,
        name:           c.name,
        status:         c.status,
        start_date:     c.start_date,
        end_date:       c.end_date,
        company_id:     c.company_id,
        number:         c.number,
        object:         c.object,
        value_per_pfus: c.value_per_pfus,
        currency:       c.currency,
        projectCount:   (c.projects || []).length,
        slaCount:       (c.contract_slas || []).length,
      }));

      setContracts(list);
      setKpis({
        total:    list.length,
        active:   list.filter(c => c.status === 'active').length,
        paused:   list.filter(c => c.status === 'paused').length,
        critical: list.filter(c => {
          if (!c.end_date) return false;
          const daysLeft = Math.ceil(
            (new Date(c.end_date).getTime() - Date.now()) / 86_400_000
          );
          return daysLeft >= 0 && daysLeft <= 30;
        }).length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── loadFormData ──────────────────────────────────────────────────────────
  const loadFormData = async (contractId: string): Promise<ContractFormData> => {
    const { data } = await supabase
      .from('contracts')
      .select(`
        id, name, status, start_date, end_date,
        company_id, number, object, value_per_pfus, currency,
        contract_teams:contract_teams(team_id),
        projects:projects(id),
        contract_slas:contract_slas(sla_id)
      `)
      .eq('id', contractId)
      .single();

    if (!data) return { ...EMPTY_CONTRACT_FORM };
    return {
      name:           data.name       ?? '',
      status:         data.status     ?? 'active',
      start_date:     data.start_date ?? '',
      end_date:       data.end_date   ?? '',
      company_id:     data.company_id ?? null,
      number:         (data as any).number         ?? '',
      object:         (data as any).object         ?? '',
      value_per_pfus: (data as any).value_per_pfus != null
        ? String((data as any).value_per_pfus)
        : '',
      currency:       (data as any).currency       ?? 'BRL',
      team_ids:    ((data as any).contract_teams || []).map((r: any) => r.team_id),
      project_ids: ((data as any).projects       || []).map((r: any) => r.id),
      sla_ids:     ((data as any).contract_slas  || []).map((r: any) => r.sla_id),
    };
  };

  // ── persist helpers ───────────────────────────────────────────────────────
  const persistRelations = async (contractId: string, data: ContractFormData) => {
    await Promise.all([
      supabase.from('contract_teams').delete().eq('contract_id', contractId),
      supabase.from('projects').update({ contract_id: null }).eq('contract_id', contractId),
      supabase.from('contract_slas').delete().eq('contract_id', contractId),
    ]);
    const inserts: Promise<any>[] = [];
    if (data.team_ids.length)
      inserts.push(supabase.from('contract_teams').insert(
        data.team_ids.map(tid => ({ contract_id: contractId, team_id: tid }))
      ));
    if (data.project_ids.length)
      inserts.push(supabase.from('projects').update({ contract_id: contractId })
        .in('id', data.project_ids));
    if (data.sla_ids.length)
      inserts.push(supabase.from('contract_slas').insert(
        data.sla_ids.map(sid => ({ contract_id: contractId, sla_id: sid }))
      ));
    await Promise.all(inserts);
  };

  const buildPayload = (data: ContractFormData) => ({
    name:       data.name.trim(),
    status:     data.status,
    start_date: data.start_date || null,
    end_date:   data.end_date   || null,
    company_id: data.company_id || null,
    number:     data.number.trim()  || null,
    object:     data.object.trim()  || null,
    value_per_pfus: data.value_per_pfus
      ? parseFloat(data.value_per_pfus)
      : null,
    currency:   data.currency || 'BRL',
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const create = async (data: ContractFormData): Promise<boolean> => {
    const { data: inserted, error } = await supabase
      .from('contracts')
      .insert(buildPayload(data))
      .select('id')
      .single();
    if (error || !inserted) { toast.error('Erro ao criar contrato'); return false; }
    await persistRelations(inserted.id, data);
    toast.success('Contrato criado com sucesso');
    await load();
    return true;
  };

  const update = async (id: string, data: ContractFormData): Promise<boolean> => {
    const { error } = await supabase
      .from('contracts')
      .update(buildPayload(data))
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar contrato'); return false; }
    await persistRelations(id, data);
    toast.success('Contrato atualizado');
    await load();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir contrato'); return false; }
    toast.success('Contrato excluído');
    await load();
    return true;
  };

  return { contracts, loading, kpis, create, update, remove, loadFormData };
}
