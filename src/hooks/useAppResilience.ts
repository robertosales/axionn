import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, focusManager } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * useAppResilience — Otimização de Performance e Resiliência
 * 1. Logout automático após 15 minutos de inatividade.
 * 2. Pausa/Resumo de processamento ao trocar de aba (visibilitychange).
 */
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutos

export function useAppResilience() {
  const { signOut, session } = useAuth();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (session) {
      timerRef.current = setTimeout(() => {
        console.warn('[Resilience] Sessão encerrada por inatividade (15min)');
        toast.info("Sua sessão expirou por inatividade.");
        signOut();
      }, IDLE_TIMEOUT);
    }
  }, [session, signOut]);

  useEffect(() => {
    if (!session) return;

    // 1. Gestão de Visibilidade (Background vs Foreground)
    // TanStack Query focusManager controla o refetchOnWindowFocus e pausagem de queries
    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      focusManager.setFocused(isVisible);

      if (!isVisible) {
        // Cancela requisições em voo para poupar banda/CPU do banco
        queryClient.cancelQueries();
        console.log('[Resilience] App em background: Pausando requisições e pooling.');
      } else {
        // Retoma e invalida queries ativas para garantir dados frescos
        queryClient.invalidateQueries({ type: 'active' });
        console.log('[Resilience] App em foreground: Retomando sincronização.');
      }
    };

    // 2. Monitoramento de Inatividade
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const onActivity = () => resetTimer();

    document.addEventListener('visibilitychange', handleVisibility);
    activityEvents.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    resetTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      activityEvents.forEach(e => window.removeEventListener(e, onActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [session, queryClient, resetTimer]);
}
