/**
 * useContracts — admin pages compat hook.
 *
 * Mapeia o shape esperado pelo AdminContratosPage / ContractWizardDialog
 * para a estrutura real no banco (tables: contracts, contract_slas, projects).
 *
 *   Frontend          ↔ Banco
 *   start_date         starts_at
 *   end_date           ends_at
 *   criticidade        priority (urgent|high|medium|low)
 *   sla_type           sla_type (24x7|business_hours|custom)
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SlaType = '24x7' | 'business_hours' | 'custom';

export interface ContractSla {
  id?:                       string;
  contract_id?:              string;
  criticidade:               'baixa' | 'media' | 'alta' | 'critica';
  sla_type:                  SlaType;
  response_time_minutes:     number;
  resolution_time_minutes:   number;
}

export interface Contract {
  id:           string;
  name:         string;
  description:  string | null;
  status:       string;
  start_date:   string | null;
  end_date:     string | null;
  projectCount?: number;
  slaCount?:    number;
}

export interface ContractFormData {
  name:        string;
  description: string;
  status:      string;
  start_date:  string;
  end_date:    string;
  project_ids: string[];
  slas:        ContractSla[];
}

const DEFAULT_SLAS: ContractSla[] = [
  { criticidade: 'baixa',   sla_type: 'business_hours', response_time_minutes: 240, resolution_time_minutes: 960  },
  { criticidade: 'media',   sla_type: 'business_hours', response_time_minutes: 120, resolution_time_minutes: 480  },
  { criticidade: 'alta',    sla_type: 'business_hours', response_time_minutes: 45,  resolution_time_minutes: 240  },
  { criticidade: 'critica', sla_type: '24x7',           response_time_minutes: 15,  resolution_time_minutes: 120  },
];

export const EMPTY_FORM: ContractFormData = {
  name:        '',
  description: '',
  status:      'active',
  start_date:  '',
  end_date:    '',
  project_ids: [],
  slas:        DEFAULT_SLAS,
};

// ── Mapeamento criticidade ↔ priority ───────────────────────────────────────
const CRITICIDADE_TO_PRIORITY: Record<ContractSla['criticidade'], string> = {
  baixa: 'low', media: 'medium', alta: 'high', critica: 'urgent',
};
const PRIORITY_TO_CRITICIDADE: Record<string, ContractSla['criticidade']> = {
  low: 'baixa', medium: 'media', high: 'alta', urgent: 'critica',
};

interface Kpis { total: number; active: number; paused: number; critical: number }

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [kpis, setKpis]           = useState<Kpis>({ total: 0, active: 0, paused: 0, critical: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('contracts')
        .select('id, name, description, status, starts_at, ends_at, contract_slas(id), projects(id)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const list: Contract[] = (data ?? []).map((c: any) => ({
        id:           c.id,
        name:         c.name,
        description:  c.description,
        status:       c.status,
        start_date:   c.starts_at,
        end_date:     c.ends_at,
        projectCount: c.projects?.length ?? 0,
        slaCount:     c.contract_slas?.length ?? 0,
      }));

      setContracts(list);
      setKpis({
        total:    list.length,
        active:   list.filter(c => c.status === 'active').length,
        paused:   list.filter(c => c.status === 'paused').length,
        critical: list.filter(c => c.status === 'expired' || c.status === 'cancelled').length,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── loadFormData: monta o ContractFormData para o wizard ──────────────────
  const loadFormData = useCallback(async (id: string): Promise<ContractFormData> => {
    const { data, error } = await (supabase as any)
      .from('contracts')
      .select('*, contract_slas(*), projects(id)')
      .eq('id', id)
      .single();
    if (error || !data) return { ...EMPTY_FORM };

    const slas: ContractSla[] = DEFAULT_SLAS.map(def => {
      const dbRow = (data.contract_slas ?? []).find(
        (r: any) => PRIORITY_TO_CRITICIDADE[r.priority] === def.criticidade,
      );
      if (!dbRow) return def;
      return {
        id:                       dbRow.id,
        contract_id:              dbRow.contract_id,
        criticidade:              def.criticidade,
        sla_type:                 (dbRow.sla_type as SlaType) ?? def.sla_type,
        response_time_minutes:    dbRow.response_time_minutes,
        resolution_time_minutes:  dbRow.resolution_time_minutes,
      };
    });

    return {
      name:        data.name ?? '',
      description: data.description ?? '',
      status:      data.status ?? 'active',
      start_date:  data.starts_at ? String(data.starts_at).slice(0, 10) : '',
      end_date:    data.ends_at   ? String(data.ends_at).slice(0, 10)   : '',
      project_ids: (data.projects ?? []).map((p: any) => p.id),
      slas,
    };
  }, []);

  // ── helper compartilhado: persiste SLAs + projetos vinculados ─────────────
  async function persistRelations(contractId: string, form: ContractFormData) {
    // SLAs: delete + insert
    await (supabase as any).from('contract_slas').delete().eq('contract_id', contractId);
    if (form.slas.length > 0) {
      const rows = form.slas.map(s => ({
        contract_id:              contractId,
        priority:                 CRITICIDADE_TO_PRIORITY[s.criticidade],
        sla_type:                 s.sla_type,
        response_time_minutes:    s.response_time_minutes,
        resolution_time_minutes:  s.resolution_time_minutes,
        business_hours_only:      s.sla_type === 'business_hours',
      }));
      const { error: e1 } = await (supabase as any).from('contract_slas').insert(rows);
      if (e1) throw e1;
    }

    // Projetos: desvincula os antigos, vincula os novos
    await (supabase as any).from('projects').update({ contract_id: null }).eq('contract_id', contractId);
    if (form.project_ids.length > 0) {
      const { error: e2 } = await (supabase as any)
        .from('projects')
        .update({ contract_id: contractId })
        .in('id', form.project_ids);
      if (e2) throw e2;
    }
  }

  const create = useCallback(async (form: ContractFormData): Promise<boolean> => {
    try {
      const { data, error } = await (supabase as any)
        .from('contracts')
        .insert({
          name:        form.name,
          description: form.description || null,
          status:      form.status,
          starts_at:   form.start_date || null,
          ends_at:     form.end_date   || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      await persistRelations(data.id, form);
      toast.success('Contrato criado');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao criar contrato');
      return false;
    }
  }, [load]);

  const update = useCallback(async (id: string, form: ContractFormData): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('contracts')
        .update({
          name:        form.name,
          description: form.description || null,
          status:      form.status,
          starts_at:   form.start_date || null,
          ends_at:     form.end_date   || null,
        })
        .eq('id', id);
      if (error) throw error;
      await persistRelations(id, form);
      toast.success('Contrato atualizado');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar contrato');
      return false;
    }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    try {
      await (supabase as any).from('projects').update({ contract_id: null }).eq('contract_id', id);
      await (supabase as any).from('contract_slas').delete().eq('contract_id', id);
      const { error } = await (supabase as any).from('contracts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Contrato excluído');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir contrato');
    }
  }, [load]);

  return { contracts, loading, kpis, create, update, remove, loadFormData, reload: load };
}