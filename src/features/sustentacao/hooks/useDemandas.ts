import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as svc from "../services/demandas.service";
import type { Demanda, DemandaTransition, DemandaHour } from "../types/demanda";
import { REQUIRES_JUSTIFICATIVA } from "../types/demanda";

export type ResponsavelEntry = { papel: string; nome: string; created_at: string };
export type DemandaEnriquecida = Demanda & { responsaveis_list: ResponsavelEntry[] };

/**
 * Enriquece as demandas com TODOS os responsáveis em UMA única query via join.
 * Elimina a necessidade de busca separada no DemandasList.
 */
async function enrichComResponsaveis(demandas: Demanda[]): Promise<DemandaEnriquecida[]> {
  if (demandas.length === 0) return demandas.map((d) => ({ ...d, responsaveis_list: [] }));
  const ids = demandas.map((d) => d.id);

  const { data } = await supabase
    .from("demanda_responsaveis")
    .select("demanda_id, papel, created_at, profiles(display_name)")
    .in("demanda_id", ids)
    .order("created_at", { ascending: true });

  const rows = (data || []) as any[];

  // Mapa demanda_id → lista de responsáveis
  const mapaResp = new Map<string, ResponsavelEntry[]>();
  rows.forEach((r) => {
    const nome = r.profiles?.display_name ?? "";
    if (!nome) return;
    const lista = mapaResp.get(r.demanda_id) ?? [];
    lista.push({ papel: r.papel, nome, created_at: r.created_at });
    mapaResp.set(r.demanda_id, lista);
  });

  return demandas.map((d) => {
    const resp = mapaResp.get(d.id) ?? [];

    const getPorPapel = (papel: string) =>
      resp.find((r) => r.papel === papel)?.nome ?? null;

    return {
      ...d,
      // Compat. legada — campos individuais por papel
      responsavel_dev:        getPorPapel("desenvolvedor") ?? d.responsavel_dev,
      responsavel_requisitos: getPorPapel("analista")      ?? d.responsavel_requisitos,
      responsavel_arquiteto:  getPorPapel("arquiteto")     ?? d.responsavel_arquiteto,
      responsavel_teste:      getPorPapel("testador")      ?? d.responsavel_teste,
      // Lista completa — consumida por DemandasList e Board sem nova query
      responsaveis_list: resp,
    };
  });
}

export function useDemandas() {
  const { currentTeamId, user } = useAuth();
  const [demandas, setDemandas] = useState<DemandaEnriquecida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!currentTeamId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await svc.fetchDemandas(currentTeamId);
      const enriched = await enrichComResponsaveis(data);
      setDemandas(enriched);
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro ao carregar demandas");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [currentTeamId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!currentTeamId) return;
    const channel = supabase
      .channel(`demandas-rt-${currentTeamId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "demandas", filter: `team_id=eq.${currentTeamId}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setDemandas((prev) => prev.filter((d) => d.id !== payload.old.id));
            return;
          }
          if (payload.eventType === "INSERT") {
            const [enriched] = await enrichComResponsaveis([payload.new as Demanda]);
            setDemandas((prev) => [...prev, enriched]);
            return;
          }
          if (payload.eventType === "UPDATE") {
            const [enriched] = await enrichComResponsaveis([payload.new as Demanda]);
            setDemandas((prev) => prev.map((d) => (d.id === enriched.id ? enriched : d)));
            return;
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentTeamId]);

  const create = async (d: Partial<Demanda>) => {
    if (!currentTeamId) return;
    try {
      const created = await svc.createDemanda({ ...d, team_id: currentTeamId, rhm: d.rhm! });
      if (user) {
        await svc.addTransition({ demanda_id: created.id, from_status: null, to_status: "nova", user_id: user.id, justificativa: null });
      }
      toast.success("Demanda criada com sucesso");
    } catch {
      toast.error("Erro ao criar demanda");
    }
  };

  const update = async (id: string, updates: Partial<Demanda>) => {
    try {
      await svc.updateDemanda(id, updates);
      toast.success("Demanda atualizada com sucesso");
    } catch {
      toast.error("Erro ao atualizar demanda");
    }
  };

  const moveTo = async (demanda: Demanda, newStatus: string, justificativa?: string) => {
    if ((REQUIRES_JUSTIFICATIVA as readonly string[]).includes(newStatus) && !justificativa) {
      toast.error("Justificativa obrigatória para este status");
      return false;
    }
    try {
      await svc.updateDemanda(demanda.id, { situacao: newStatus });
      if (user) {
        await svc.addTransition({ demanda_id: demanda.id, from_status: demanda.situacao, to_status: newStatus, user_id: user.id, justificativa: justificativa || null });
      }
      toast.success("Status atualizado com sucesso");
      return true;
    } catch {
      toast.error("Erro ao atualizar status");
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteDemanda(id);
      toast.success("Demanda excluída com sucesso");
    } catch {
      toast.error("Erro ao excluir demanda");
    }
  };

  return { demandas, loading, error, reload: load, create, update, moveTo, remove };
}

export function useTransitions(demandaId: string | null) {
  const [transitions, setTransitions] = useState<DemandaTransition[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!demandaId) return;
    setLoading(true);
    try {
      const data = await svc.fetchTransitions(demandaId);
      setTransitions(data);
    } finally {
      setLoading(false);
    }
  }, [demandaId]);

  useEffect(() => { load(); }, [load]);
  return { transitions, loading, reload: load };
}

export function useHours(demandaId: string | null) {
  const { user } = useAuth();
  const [hours, setHours] = useState<DemandaHour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!demandaId) return;
    setLoading(true);
    const data = await svc.fetchHours(demandaId);
    setHours(data);
    setLoading(false);
  }, [demandaId]);

  useEffect(() => { load(); }, [load]);

  const add = async (h: { horas: number; fase: string; descricao: string; created_at?: string }) => {
    if (!demandaId || !user) return;
    try {
      await svc.addHours({ demanda_id: demandaId, user_id: user.id, ...h });
      toast.success("Horas registradas com sucesso");
      await load();
    } catch {
      toast.error("Erro ao registrar horas");
    }
  };

  const update = async (
    id: string,
    h: { horas: number; fase: string; descricao: string; user_id?: string },
  ) => {
    try {
      await svc.updateHour(id, h);
      toast.success("Registro atualizado com sucesso");
      await load();
    } catch {
      toast.error("Erro ao atualizar registro");
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteHour(id);
      toast.success("Registro excluído com sucesso");
      await load();
    } catch {
      toast.error("Erro ao excluir registro");
    }
  };

  const total = hours.reduce((s, h) => s + Number(h.horas), 0);
  return { hours, loading, add, update, remove, total, reload: load };
}
