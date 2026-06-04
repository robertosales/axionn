/**
 * useSLARealtimeAlerts
 * 
 * Escuta UPDATE na tabela `demandas` via Supabase Realtime.
 * Quando `sla_status` muda para `em_risco` ou `violado`:
 *  1. Exibe toast colorido via sonner
 *  2. Insere registro na tabela `notifications` para persistir no sino
 *
 * Uso: montar uma única vez no layout da Sala de Sustentação:
 *   useSLARealtimeAlerts({ teamId, contractId })
 */
import { useEffect, useRef } from 'react';
import { toast }    from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth }  from '@/contexts/AuthContext';
import { ShieldAlert, ShieldX } from 'lucide-react';
import React from 'react';

export type SlaAlertLevel = 'em_risco' | 'violado';

interface DemandaPayload {
  id:          string;
  rhm?:        string;
  descricao?:  string;
  sla_status?: string;
  contract_id?: string;
  team_id?:    string;
}

interface Options {
  /** Se fornecido, filtra alertas apenas deste time */
  teamId?:     string;
  /** Se fornecido, filtra alertas apenas deste contrato */
  contractId?: string;
  /** Desabilita o listener sem desmontar o hook */
  enabled?: boolean;
}

const ALERT_CFG = {
  em_risco: {
    title:   (rhm: string) => `SLA em Risco — ${rhm}`,
    desc:    'Demanda próxima de violar o prazo SLA.',
    icon:    React.createElement(ShieldAlert, { className: 'h-4 w-4 text-amber-500' }),
    style:   { borderLeft: '3px solid #f59e0b' } as React.CSSProperties,
    notifType: 'sla_risco',
  },
  violado: {
    title:   (rhm: string) => `SLA Violado — ${rhm}`,
    desc:    'O prazo SLA desta demanda foi ultrapassado.',
    icon:    React.createElement(ShieldX, { className: 'h-4 w-4 text-red-500' }),
    style:   { borderLeft: '3px solid #ef4444' } as React.CSSProperties,
    notifType: 'sla_violado',
  },
};

export function useSLARealtimeAlerts({
  teamId,
  contractId,
  enabled = true,
}: Options = {}) {
  const { profile } = useAuth();
  const userId = profile?.user_id ?? '';

  // Evita duplicar toasts para o mesmo (id + status) numa rápida rajada de eventos
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !userId) return;

    const channelKey = [
      'sla-alerts',
      teamId     ?? 'all',
      contractId ?? 'all',
      userId,
    ].join('-');

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'demandas',
          // Filtragem no servidor (requer coluna indexada no Supabase Realtime filter)
          // Se teamId não for passável como filter, a triagem é feita no cliente abaixo
        },
        async (payload) => {
          const prev = payload.old as DemandaPayload;
          const next = payload.new as DemandaPayload;

          const newStatus = next.sla_status as SlaAlertLevel | undefined;
          const oldStatus = prev.sla_status;

          // Ignora se status SLA não mudou ou não é relevante
          if (!newStatus || newStatus === oldStatus) return;
          if (newStatus !== 'em_risco' && newStatus !== 'violado') return;

          // Filtros de escopo (cliente)
          if (teamId     && next.team_id     !== teamId)     return;
          if (contractId && next.contract_id !== contractId) return;

          // Deduplicação: ignora se já exibimos este alerta recentemente
          const dedupeKey = `${next.id}:${newStatus}`;
          if (seen.current.has(dedupeKey)) return;
          seen.current.add(dedupeKey);
          // Remove da deduplicação após 30s
          setTimeout(() => seen.current.delete(dedupeKey), 30_000);

          const rhm = next.rhm ?? next.id.slice(0, 8);
          const cfg = ALERT_CFG[newStatus];

          // 1) Toast imediato
          toast(cfg.title(rhm), {
            description: cfg.desc,
            duration:    8000,
            style:       cfg.style,
            icon:        cfg.icon,
          });

          // 2) Persiste na tabela notifications (sino)
          await supabase.from('notifications').insert({
            user_id:  userId,
            type:     cfg.notifType,
            title:    cfg.title(rhm),
            message:  `${cfg.desc} (${next.descricao ?? ''})`.trim(),
            link_id:  next.id,
            is_read:  false,
          } as any);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, teamId, contractId, enabled]);
}
