/**
 * useKnowledgeLibrary
 * --------------------
 * Hook que gerencia estado e operações da Biblioteca APF.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  fetchKnowledgePatterns,
  fetchLearningMetrics,
  fetchKnowledgeStats,
  updatePatternStatus,
  type KnowledgePattern,
  type LearningMetric,
  type KnowledgeStats,
  type PatternStatus,
} from "../services/knowledge.service";

export function useKnowledgeLibrary() {
  const [patterns, setPatterns]       = useState<KnowledgePattern[]>([]);
  const [metrics, setMetrics]         = useState<LearningMetric[]>([]);
  const [stats, setStats]             = useState<KnowledgeStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState<string | null>(null); // id do padrão sendo atualizado
  const [statusFilter, setStatusFilter] = useState<PatternStatus | "all">("auto");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusFilter === "all" ? undefined : statusFilter;
      const domain = domainFilter  === "all" ? undefined : domainFilter;
      const [p, m, s] = await Promise.all([
        fetchKnowledgePatterns(status, domain),
        fetchLearningMetrics(12),
        fetchKnowledgeStats(),
      ]);
      setPatterns(p);
      setMetrics(m);
      setStats(s);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error("Erro ao carregar Biblioteca APF", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, domainFilter]);

  useEffect(() => { load(); }, [load]);

  const approvePattern = useCallback(async (id: string) => {
    setUpdating(id);
    try {
      await updatePatternStatus(id, "validated");
      setPatterns((prev) =>
        prev.map((p) => p.id === id ? { ...p, status: "validated" as PatternStatus } : p),
      );
      toast.success("Padrão validado com sucesso");
    } catch (err) {
      toast.error("Erro ao validar padrão", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setUpdating(null);
    }
  }, []);

  const rejectPattern = useCallback(async (id: string) => {
    setUpdating(id);
    try {
      await updatePatternStatus(id, "rejected");
      setPatterns((prev) =>
        prev.map((p) => p.id === id ? { ...p, status: "rejected" as PatternStatus } : p),
      );
      toast.success("Padrão rejeitado");
    } catch (err) {
      toast.error("Erro ao rejeitar padrão", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setUpdating(null);
    }
  }, []);

  // Lista de domínios únicos para o filtro
  const domains = Array.from(
    new Set(patterns.map((p) => p.domain).filter(Boolean) as string[]),
  ).sort();

  return {
    patterns,
    metrics,
    stats,
    loading,
    updating,
    lastRefresh,
    statusFilter,
    setStatusFilter,
    domainFilter,
    setDomainFilter,
    domains,
    refresh: load,
    approvePattern,
    rejectPattern,
  };
}
