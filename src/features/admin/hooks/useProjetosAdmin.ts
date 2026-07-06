import { useCallback, useEffect, useState } from "react";
import {
  fetchProjetosAdmin,
  createProjetoAdmin,
  updateProjetoAdmin,
  archiveProjetoAdmin,
  type CreateProjetoPayload,
  type ProjetoAdmin,
} from "../services/projects.service";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useProjetosAdmin(contractId?: string | null) {
  const { enabled, currentOrganizationId, canOperate } = useOrganization();
  const [projetos, setProjetos] = useState<ProjetoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (enabled && !currentOrganizationId) {
        setProjetos([]);
        return;
      }

      const rows = await fetchProjetosAdmin(
        enabled ? currentOrganizationId : undefined,
      );
      setProjetos(
        contractId
          ? rows.filter((project) => project.contract_id === contractId)
          : rows,
      );
    } catch (loadError) {
      console.error("[useProjetosAdmin] load:", loadError);
      setProjetos([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar projetos",
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, currentOrganizationId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const assertWritableOrganization = () => {
    if (!enabled) return;
    if (!currentOrganizationId || !canOperate) {
      throw new Error("A organização atual não permite alterações");
    }
  };

  const create = async (payload: CreateProjetoPayload) => {
    assertWritableOrganization();
    const result = await createProjetoAdmin(
      payload,
      enabled ? currentOrganizationId : undefined,
    );
    await load();
    return result;
  };

  const update = async (
    id: string,
    payload: Partial<ProjetoAdmin>,
  ) => {
    assertWritableOrganization();
    const result = await updateProjetoAdmin(
      id,
      payload,
      enabled ? currentOrganizationId : undefined,
    );
    await load();
    return result;
  };

  const archive = async (id: string) => {
    assertWritableOrganization();
    await archiveProjetoAdmin(
      id,
      enabled ? currentOrganizationId : undefined,
    );
    await load();
  };

  return { projetos, loading, error, reload: load, create, update, archive };
}
