import { useCallback, useEffect, useState } from "react";
import {
  listDeploymentTasks,
  addDeploymentTask,
  updateDeploymentTask,
  deleteDeploymentTask,
} from "../services/rdmService";
import type {
  RdmDeploymentTask,
  RdmDeploymentTaskInsert,
  RdmDeploymentTaskUpdate,
} from "../types/rdm";

export function useRdmDeploymentTasks(rdmId: string | null) {
  const [tasks, setTasks]     = useState<RdmDeploymentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      setTasks(await listDeploymentTasks(rdmId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const addTask = useCallback(async (
    payload: Omit<RdmDeploymentTaskInsert, "rdm_id">
  ) => {
    if (!rdmId) return;
    const created = await addDeploymentTask({ ...payload, rdm_id: rdmId });
    setTasks((prev) => [...prev, created]);
  }, [rdmId]);

  const updateTask = useCallback(async (
    id: string, updates: RdmDeploymentTaskUpdate
  ) => {
    await updateDeploymentTask(id, updates);
    setTasks((prev) =>
      prev.map((t) => t.id === id ? { ...t, ...updates } : t)
    );
  }, []);

  const toggleConcluido = useCallback(async (task: RdmDeploymentTask) => {
    const isConcluido = task.status === "concluido";
    const updates: RdmDeploymentTaskUpdate = {
      status:       isConcluido ? "pendente" : "concluido",
      concluido_em: isConcluido ? null : new Date().toISOString(),
    };
    await updateDeploymentTask(task.id, updates);
    setTasks((prev) =>
      prev.map((t) => t.id === task.id ? { ...t, ...updates } : t)
    );
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteDeploymentTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, loading, error, load, addTask, updateTask, toggleConcluido, removeTask };
}
