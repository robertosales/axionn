/**
 * SEC-001 — useIdleTimeout
 *
 * Detecta inatividade do usuário e dispara callbacks de aviso e logout.
 *
 * Eventos monitorados: mousemove, keydown, touchstart, click, scroll
 *
 * @param onWarn  - Chamado N segundos antes do timeout (exibe modal)
 * @param onIdle  - Chamado quando o timeout é atingido (faz logout)
 * @param onReset - Chamado quando o usuário volta a interagir
 * @param enabled - Ativa/desativa o guard (false quando não há sessão)
 * @param timeoutMs  - Tempo de inatividade para logout (padrão: 30min)
 * @param warningMs  - Antecedência do aviso antes do logout (padrão: 2min)
 */
import { useEffect, useRef, useCallback } from "react";

interface Options {
  onWarn:    () => void;
  onIdle:    () => void;
  onReset?:  () => void;
  enabled?:  boolean;
  timeoutMs?:  number;
  warningMs?:  number;
}

const EVENTS = ["mousemove", "keydown", "touchstart", "click", "scroll"] as const;
export const WARNING_BEFORE_MS = 2 * 60 * 1000;

export function useIdleTimeout({
  onWarn,
  onIdle,
  onReset,
  enabled = true,
  timeoutMs  = 30 * 60 * 1000,
  warningMs  = WARNING_BEFORE_MS,
}: Options) {
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef    = useRef(false);

  const clearTimers = useCallback(() => {
    if (idleTimer.current)  clearTimeout(idleTimer.current);
    if (warnTimer.current)  clearTimeout(warnTimer.current);
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    warnedRef.current = false;

    warnTimer.current = setTimeout(() => {
      warnedRef.current = true;
      onWarn();
    }, timeoutMs - warningMs);

    idleTimer.current = setTimeout(() => {
      onIdle();
    }, timeoutMs);
  }, [enabled, clearTimers, onWarn, onIdle, timeoutMs, warningMs]);

  const handleActivity = useCallback(() => {
    if (!enabled) return;
    if (warnedRef.current) {
      onReset?.();
    }
    resetTimer();
  }, [enabled, resetTimer, onReset]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    resetTimer();
    EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [enabled, resetTimer, handleActivity, clearTimers]);

  return { resetTimer };
}
