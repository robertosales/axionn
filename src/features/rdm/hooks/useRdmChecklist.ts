import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listChecklistItems,
  updateChecklistItem,
} from "../services/rdmService";
import type { RdmChecklistItem, RdmChecklistItemUpdate } from "../types/rdm";

// Ordem canônica e regra de desbloqueio:
// Execução só libera quando Pré = 100%
// Pós só libera quando Execução = 100%
const FASE_SEQUENCE = [
  "pre_implantacao",
  "execucao",
  "pos_implantacao",
] as const;

export type FaseKey = typeof FASE_SEQUENCE[number];

export interface FaseStatus {
  key:       FaseKey;
  pct:       number;   // 0-100
  total:     number;
  done:      number;
  liberada:  boolean;  // false = bloqueada pela fase anterior
  concluida: boolean;  // pct === 100
}

function calcFase(items: RdmChecklistItem[]): number {
  if (items.length === 0) return 100; // sem itens = não bloqueia a próxima
  const done = items.filter(
    (i) => i.status === "concluido" || i.status === "nao_aplicavel"
  ).length;
  return Math.round((done / items.length) * 100);
}

export function useRdmChecklist(rdmId: string | null) {
  const [items, setItems]     = useState<RdmChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listChecklistItems(rdmId);
      setItems(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(
    async (id: string, updates: RdmChecklistItemUpdate) => {
      await updateChecklistItem(id, updates);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updated_at: new Date().toISOString() }
            : item
        )
      );
    },
    []
  );

  const grouped = useMemo(() =>
    items.reduce<Record<string, RdmChecklistItem[]>>((acc, item) => {
      (acc[item.categoria] = acc[item.categoria] ?? []).push(item);
      return acc;
    }, {}),
    [items]
  );

  // Progresso global (todas as fases)
  const progress = items.length === 0
    ? 0
    : Math.round(
        items.filter((i) => i.status === "concluido" || i.status === "nao_aplicavel").length /
        items.length * 100
      );

  // Status por fase com regra de bloqueio sequencial
  const faseStatus = useMemo((): FaseStatus[] => {
    let anteriorConcluida = true; // Pré-implantação sempre liberada
    return FASE_SEQUENCE.map((key) => {
      const fItems    = grouped[key] ?? [];
      const pct       = calcFase(fItems);
      const concluida = pct === 100;
      const liberada  = anteriorConcluida;
      anteriorConcluida = concluida; // próxima só libera se esta concluiu
      return {
        key,
        pct,
        total:    fItems.length,
        done:     fItems.filter((i) =>
                    i.status === "concluido" || i.status === "nao_aplicavel"
                  ).length,
        liberada,
        concluida,
      };
    });
  }, [grouped]);

  return { items, grouped, progress, faseStatus, loading, error, load, update };
}
