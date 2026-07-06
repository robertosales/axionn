import { useCallback, useEffect, useState } from "react";
import {
  createContract,
  fetchActiveContracts,
  fetchContractById,
  fetchContracts,
  updateContract,
  upsertContractSlas,
} from "../services/contracts.service";
import type { Contract, ContractFormData, SlaRow } from "../types/contract";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useContracts() {
  const { enabled, currentOrganizationId } = useOrganization();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (enabled && !currentOrganizationId) {
        setContracts([]);
        return;
      }
      const data = await fetchContracts(
        enabled ? currentOrganizationId : undefined,
      );
      setContracts(data as Contract[]);
    } catch (loadError) {
      setContracts([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar contratos",
      );
    } finally {
      setLoading(false);
    }
  }, [currentOrganizationId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { contracts, loading, error, reload: load };
}

export function useContractDetail(contractId: string) {
  const { enabled, currentOrganizationId } = useOrganization();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contractId) return;
    if (enabled && !currentOrganizationId) {
      setContract(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchContractById(
      contractId,
      enabled ? currentOrganizationId : undefined,
    )
      .then((data) => setContract(data as Contract))
      .catch(() => setContract(null))
      .finally(() => setLoading(false));
  }, [contractId, currentOrganizationId, enabled]);

  return { contract, loading };
}

export function useSaveContract() {
  const { enabled, currentOrganizationId, canOperate } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (
      form: ContractFormData,
      slas: SlaRow[],
      existingId?: string,
    ): Promise<string | null> => {
      if (enabled && (!currentOrganizationId || !canOperate)) {
        setError("A organização atual não permite alterações");
        return null;
      }

      setSaving(true);
      setError(null);
      try {
        const organizationId = enabled ? currentOrganizationId : undefined;
        const id = existingId
          ? (await updateContract(existingId, form, organizationId), existingId)
          : await createContract(form, organizationId);
        await upsertContractSlas(id, slas);
        return id;
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Erro desconhecido",
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [canOperate, currentOrganizationId, enabled],
  );

  return { save, saving, error };
}

export function useActiveContracts() {
  const { enabled, currentOrganizationId } = useOrganization();
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (enabled && !currentOrganizationId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchActiveContracts(enabled ? currentOrganizationId : undefined)
      .then(setContracts)
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, [currentOrganizationId, enabled]);

  return { contracts, loading };
}
