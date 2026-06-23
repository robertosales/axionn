import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LicensePlan   = 'starter' | 'pro' | 'enterprise';
export type LicenseStatus = 'active' | 'trial' | 'expired' | 'suspended';

export interface License {
  id:              string;
  company_id:      string;
  plan:            LicensePlan;
  pf_quota_month:  number | null;
  pf_used_month:   number;
  ai_calls_quota:  number | null;
  ai_calls_used:   number;
  quota_reset_at:  string;
  valid_until:     string;
  status:          LicenseStatus;
}

export interface LicenseFormData {
  plan:            LicensePlan;
  pf_quota_month:  string;
  ai_calls_quota:  string;
  valid_until:     string;
  status:          LicenseStatus;
}

export const EMPTY_LICENSE_FORM: LicenseFormData = {
  plan:           'starter',
  pf_quota_month: '',
  ai_calls_quota: '',
  valid_until:    new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  status:         'active',
};

export function useLicenses(companyId: string | null) {
  const [license, setLicense]   = useState<License | null>(null);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { setLicense(null); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('licenses')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      setLicense(data ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar licença');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const upsert = useCallback(async (form: LicenseFormData): Promise<boolean> => {
    if (!companyId) return false;
    try {
      const payload = {
        company_id:      companyId,
        plan:            form.plan,
        pf_quota_month:  form.pf_quota_month ? Number(form.pf_quota_month) : null,
        ai_calls_quota:  form.ai_calls_quota ? Number(form.ai_calls_quota) : null,
        valid_until:     form.valid_until,
        status:          form.status,
      };
      const { error } = await (supabase as any)
        .from('licenses')
        .upsert(payload, { onConflict: 'company_id' });
      if (error) throw error;
      toast.success('Licença salva');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar licença');
      return false;
    }
  }, [companyId, load]);

  return { license, loading, upsert, reload: load };
}
