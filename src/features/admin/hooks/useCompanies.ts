import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'inactive';

export interface Company {
  id:         string;
  name:       string;
  cnpj:       string | null;
  email:      string | null;
  phone:      string | null;
  logo_url:   string | null;
  status:     CompanyStatus;
  created_at: string;
  teamCount?: number;
}

export interface CompanyFormData {
  name:     string;
  cnpj:     string;
  email:    string;
  phone:    string;
  logo_url: string;
  status:   CompanyStatus;
}

export const EMPTY_COMPANY_FORM: CompanyFormData = {
  name:     '',
  cnpj:     '',
  email:    '',
  phone:    '',
  logo_url: '',
  status:   'active',
};

interface CompanyKpis {
  total:     number;
  active:    number;
  trial:     number;
  suspended: number;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [kpis, setKpis]           = useState<CompanyKpis>({ total: 0, active: 0, trial: 0, suspended: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('id, name, cnpj, email, phone, logo_url, status, created_at, teams(id)')
        .order('name', { ascending: true });
      if (error) throw error;

      const list: Company[] = (data ?? []).map((c: any) => ({
        id:         c.id,
        name:       c.name,
        cnpj:       c.cnpj,
        email:      c.email,
        phone:      c.phone,
        logo_url:   c.logo_url,
        status:     c.status,
        created_at: c.created_at,
        teamCount:  c.teams?.length ?? 0,
      }));

      setCompanies(list);
      setKpis({
        total:     list.length,
        active:    list.filter(c => c.status === 'active').length,
        trial:     list.filter(c => c.status === 'trial').length,
        suspended: list.filter(c => c.status === 'suspended').length,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (form: CompanyFormData): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .insert({
          name:     form.name,
          cnpj:     form.cnpj     || null,
          email:    form.email    || null,
          phone:    form.phone    || null,
          logo_url: form.logo_url || null,
          status:   form.status,
        });
      if (error) throw error;
      toast.success('Empresa criada');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao criar empresa');
      return false;
    }
  }, [load]);

  const update = useCallback(async (id: string, form: CompanyFormData): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .update({
          name:     form.name,
          cnpj:     form.cnpj     || null,
          email:    form.email    || null,
          phone:    form.phone    || null,
          logo_url: form.logo_url || null,
          status:   form.status,
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Empresa atualizada');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar empresa');
      return false;
    }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Empresa excluída');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir empresa');
    }
  }, [load]);

  return { companies, loading, kpis, create, update, remove, reload: load };
}
