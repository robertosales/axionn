import { useState, useEffect, useCallback } from 'react';
import {
  fetchContracts,
  fetchContractById,
  createContract,
  updateContract,
  upsertContractSlas,
  fetchActiveContracts,
} from '../services/contracts.service';
import type { Contract, ContractFormData, SlaRow } from '../types/contract';

// ── Lista completa de contratos ───────────────────────────────────────────────
export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContracts();
      setContracts(data as Contract[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { contracts, loading, error, reload: load };
}

// ── Detalhe de um contrato ────────────────────────────────────────────────────
export function useContractDetail(contractId: string) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!contractId) return;
    setLoading(true);
    fetchContractById(contractId)
      .then((d) => setContract(d as Contract))
      .catch(() => setContract(null))
      .finally(() => setLoading(false));
  }, [contractId]);

  return { contract, loading };
}

// ── Salvar (criar ou editar) contrato + SLAs ─────────────────────────────────
export function useSaveContract() {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const save = useCallback(async (
    form: ContractFormData,
    slas: SlaRow[],
    existingId?: string,
  ): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const id = existingId
        ? (await updateContract(existingId, form), existingId)
        : await createContract(form);
      await upsertContractSlas(id, slas);
      return id;
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}

// ── Contratos ativos para selects ─────────────────────────────────────────────
export function useActiveContracts() {
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchActiveContracts()
      .then(setContracts)
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, []);

  return { contracts, loading };
}
