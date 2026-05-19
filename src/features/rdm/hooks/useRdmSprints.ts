import { useCallback, useEffect, useState } from "react";
import {
  listRdmSprints, addRdmSprint, updateRdmSprint, deleteRdmSprint,
  addRdmSprintRedmine, updateRdmSprintRedmine, deleteRdmSprintRedmine,
} from "../services/rdmService";
import type {
  RdmSprint, RdmSprintInsert, RdmSprintUpdate,
  RdmSprintRedmineInsert, RdmSprintRedmineUpdate,
} from "../types/rdm";

export function useRdmSprints(rdmId: string | null) {
  const [sprints, setSprints] = useState<RdmSprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      setSprints(await listRdmSprints(rdmId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sprints");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  // ── Sprint CRUD ──────────────────────────────────────────────────────────
  const addSprint = useCallback(async (payload: Omit<RdmSprintInsert, "rdm_id">) => {
    if (!rdmId) throw new Error("rdmId ausente — não é possível vincular sprint.");
    const created = await addRdmSprint({ ...payload, rdm_id: rdmId });
    setSprints((prev) => [...prev, { ...created, redmines: [] }]);
  }, [rdmId]);

  const updateSprint = useCallback(async (id: string, updates: RdmSprintUpdate) => {
    await updateRdmSprint(id, updates);
    setSprints((prev) =>
      prev.map((s) => s.id === id ? { ...s, ...updates } : s)
    );
  }, []);

  const removeSprint = useCallback(async (id: string) => {
    await deleteRdmSprint(id);
    setSprints((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Redmine CRUD ─────────────────────────────────────────────────────────
  const addRedmine = useCallback(async (
    rdmSprintId: string, payload: Omit<RdmSprintRedmineInsert, "rdm_sprint_id">
  ) => {
    // Salva no banco
    await addRdmSprintRedmine({ ...payload, rdm_sprint_id: rdmSprintId });
    // FIX: reload completo do Supabase para evitar race condition de cast
    // do objeto retornado pelo INSERT (campos com default podem vir ausentes)
    await listRdmSprints(rdmId!).then(setSprints);
  }, [rdmId]);

  const updateRedmine = useCallback(async (
    rdmSprintId: string, redmineId: string, updates: RdmSprintRedmineUpdate
  ) => {
    await updateRdmSprintRedmine(redmineId, updates);
    setSprints((prev) =>
      prev.map((s) =>
        s.id === rdmSprintId
          ? {
              ...s,
              redmines: (s.redmines ?? []).map((r) =>
                r.id === redmineId ? { ...r, ...updates } : r
              ),
            }
          : s
      )
    );
  }, []);

  const removeRedmine = useCallback(async (rdmSprintId: string, redmineId: string) => {
    await deleteRdmSprintRedmine(redmineId);
    setSprints((prev) =>
      prev.map((s) =>
        s.id === rdmSprintId
          ? { ...s, redmines: (s.redmines ?? []).filter((r) => r.id !== redmineId) }
          : s
      )
    );
  }, []);

  return {
    sprints, loading, error, load,
    addSprint, updateSprint, removeSprint,
    addRedmine, updateRedmine, removeRedmine,
  };
}
