import { useState, useEffect, useCallback } from 'react';
import {
  fetchContracts,
  fetchContractById,
  createContract,
  updateContract,
  upsertContractSlas,
} from '../services/contracts.service';
import type { Contract, ContractFormData, SlaRow } from '../types/contract';

// ── Lista de contratos ────────────────────────────────────────────────────────

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContracts(await fetchContracts());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { contracts, loading, error, reload };
}

// ── Detalhe de um contrato ────────────────────────────────────────────────────

export function useContractDetail(id: string | null) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setContract(await fetchContractById(id));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  return { contract, loading, error, reload };
}

// ── Salvar contrato + SLAs ────────────────────────────────────────────────────

export function useSaveContract() {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function save(
    formData: ContractFormData,
    slas: SlaRow[],
    contractId?: string
  ): Promise<string | null> {
    setSaving(true);
    setError(null);
    try {
      let id = contractId;
      if (id) {
        await updateContract(id, formData);
      } else {
        const created = await createContract(formData);
        id = created.id;
      }
      if (slas.length > 0) {
        await upsertContractSlas(id!, slas);
      }
      return id!;
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar contrato');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, error };
}
