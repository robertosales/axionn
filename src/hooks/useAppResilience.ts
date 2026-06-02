import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, focusManager } from '@tanstack/react-query';

/**
 * useAppResilience — Resiliência e Performance
 *
 * Responsabilidade única: pausar/retomar queries ao trocar de aba.
 *
 * O timer de inatividade de 15 min foi removido na refatoração P0:
 *   - Canais RT já têm cleanup correto no unmount (removeChannel).
 *   - visibilitychange já cancela queries em background.
 *   - SessionTimeoutAlert cuida do logout por inatividade (4/5 min)
 *     com aviso visual ao usuário.
 */
export function useAppResilience() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) return;

    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      focusManager.setFocused(isVisible);

      if (!isVisible) {
        queryClient.cancelQueries();
        console.log('[Resilience] App em background: pausando requisições.');
      } else {
        queryClient.invalidateQueries({ type: 'active' });
        console.log('[Resilience] App em foreground: retomando sincronização.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session, queryClient]);
}
