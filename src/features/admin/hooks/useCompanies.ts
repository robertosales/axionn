import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { resolveOrganizationOperationalError } from "@/features/organization/utils/operationalErrors";
import { toast } from "sonner";

export type CompanyStatus = "active" | "trial" | "suspended" | "inactive";

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  status: CompanyStatus;
  created_at: string;
  org_id?: string | null;
  teamCount?: number;
}

export interface CompanyFormData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  logo_url: string;
  status: CompanyStatus;
}

export const EMPTY_COMPANY_FORM: CompanyFormData = {
  name: "",
  cnpj: "",
  email: "",
  phone: "",
  logo_url: "",
  status: "active",
};

interface CompanyKpis {
  total: number;
  active: number;
  trial: number;
  suspended: number;
}

const EMPTY_KPIS: CompanyKpis = {
  total: 0,
  active: 0,
  trial: 0,
  suspended: 0,
};

function normalizeCompany(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    name: String(row.name ?? "Empresa"),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    logo_url: row.logo_url ? String(row.logo_url) : null,
    status: String(row.status ?? "active") as CompanyStatus,
    created_at: String(row.created_at ?? ""),
    org_id: row.org_id ? String(row.org_id) : null,
    teamCount: Number(
      row.team_count ?? (Array.isArray(row.teams) ? row.teams.length : 0),
    ),
  };
}

export function useCompanies() {
  const { enabled, currentOrganizationId, canOperate } = useOrganization();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<CompanyKpis>(EMPTY_KPIS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows: Array<Record<string, unknown>> = [];

      if (enabled) {
        if (!currentOrganizationId) {
          setCompanies([]);
          setKpis(EMPTY_KPIS);
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_accessible_companies_v2",
          { p_org_id: currentOrganizationId },
        );
        if (error) throw error;
        rows = (data ?? []) as Array<Record<string, unknown>>;
      } else {
        const { data, error } = await supabase
          .from("companies")
          .select(
            "id, name, cnpj, email, phone, logo_url, status, created_at, teams(id)",
          )
          .order("name", { ascending: true });
        if (error) throw error;
        rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      }

      const list = rows.map(normalizeCompany);
      setCompanies(list);
      setKpis({
        total: list.length,
        active: list.filter((company) => company.status === "active").length,
        trial: list.filter((company) => company.status === "trial").length,
        suspended: list.filter((company) => company.status === "suspended")
          .length,
      });
    } catch (error) {
      console.error("[useCompanies] load:", error);
      setCompanies([]);
      setKpis(EMPTY_KPIS);
      toast.error("Não foi possível carregar as empresas desta organização");
    } finally {
      setLoading(false);
    }
  }, [currentOrganizationId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const assertWritableOrganization = useCallback(() => {
    if (!enabled) return true;
    if (!currentOrganizationId || !canOperate) {
      toast.error("A organização atual não permite alterações");
      return false;
    }
    return true;
  }, [canOperate, currentOrganizationId, enabled]);

  const create = useCallback(
    async (form: CompanyFormData): Promise<boolean> => {
      if (!assertWritableOrganization()) return false;

      try {
        const { error } =
          enabled && currentOrganizationId
            ? await (supabase as any).rpc("create_organization_company_v2", {
                p_org_id: currentOrganizationId,
                p_name: form.name,
                p_cnpj: form.cnpj || null,
                p_email: form.email || null,
                p_phone: form.phone || null,
                p_logo_url: form.logo_url || null,
                p_status: form.status,
              })
            : await supabase.from("companies").insert({
                name: form.name,
                cnpj: form.cnpj || null,
                email: form.email || null,
                phone: form.phone || null,
                logo_url: form.logo_url || null,
                status: form.status,
              });
        if (error) throw error;
        toast.success("Empresa criada");
        await load();
        return true;
      } catch (error) {
        toast.error(resolveOrganizationOperationalError(error, "Erro ao criar empresa"));
        return false;
      }
    },
    [assertWritableOrganization, currentOrganizationId, enabled, load],
  );

  const update = useCallback(
    async (id: string, form: CompanyFormData): Promise<boolean> => {
      if (!assertWritableOrganization()) return false;

      try {
        const { error } =
          enabled && currentOrganizationId
            ? await (supabase as any).rpc("update_organization_company_v2", {
                p_org_id: currentOrganizationId,
                p_company_id: id,
                p_name: form.name,
                p_cnpj: form.cnpj || null,
                p_email: form.email || null,
                p_phone: form.phone || null,
                p_logo_url: form.logo_url || null,
                p_status: form.status,
              })
            : await supabase
                .from("companies")
                .update({
                  name: form.name,
                  cnpj: form.cnpj || null,
                  email: form.email || null,
                  phone: form.phone || null,
                  logo_url: form.logo_url || null,
                  status: form.status,
                })
                .eq("id", id);
        if (error) throw error;
        toast.success("Empresa atualizada");
        await load();
        return true;
      } catch (error) {
        toast.error(resolveOrganizationOperationalError(error, "Erro ao atualizar empresa"));
        return false;
      }
    },
    [assertWritableOrganization, currentOrganizationId, enabled, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!assertWritableOrganization()) return;

      try {
        const { error } =
          enabled && currentOrganizationId
            ? await (supabase as any).rpc("archive_organization_company_v2", {
                p_org_id: currentOrganizationId,
                p_company_id: id,
              })
            : await supabase.from("companies").delete().eq("id", id);
        if (error) throw error;
        toast.success("Empresa excluída");
        await load();
      } catch (error) {
        toast.error(resolveOrganizationOperationalError(error, "Erro ao inativar empresa"));
      }
    },
    [assertWritableOrganization, currentOrganizationId, enabled, load],
  );

  return { companies, loading, kpis, create, update, remove, reload: load };
}
