/**
 * useSessionTimeout — detecta inatividade e sinaliza para encerrar sessão.
 *
 * Correção de estabilidade:
 *   onLogout era passado como arrow function inline pelo SessionTimeoutAlert,
 *   recriando a referência a cada render. Como estava na dependência do
 *   useCallback de reset, cada re-render do pai chamava reset() silenciosamente,
 *   zerando o timer sem o usuário perceber e impedindo o aviso de aparecer.
 *
 *   Solução: capturar onLogout em um ref (onLogoutRef) e usá-lo dentro do
 *   useCallback sem adicioná-lo às dependências. O ref é atualizado a cada
 *   render via useEffect, garantindo que sempre aponte para a versão atual
 *   sem recriar os timers.
 *
 * Eventos monitorados: mousemove, keydown, mousedown, scroll, touchstart
 */
import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_WARNING_MS = 4 * 60 * 1000; // 4 min
const DEFAULT_LOGOUT_MS  = 5 * 60 * 1000; // 5 min

interface Options {
  warningMs?: number;
  logoutMs?:  number;
  onLogout:   () => void;
  enabled?:   boolean;
}

export function useSessionTimeout({
  warningMs = DEFAULT_WARNING_MS,
  logoutMs  = DEFAULT_LOGOUT_MS,
  onLogout,
  enabled   = true,
}: Options) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const warningTimer        = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const logoutTimer         = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownInterval   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref estável para onLogout: evita que arrow functions inline recriadas
  // a cada render do pai entrem nas dependências de reset() e resetem o timer.
  const onLogoutRef = useRef(onLogout);
  useEffect(() => { onLogoutRef.current = onLogout; });

  const clearAll = useCallback(() => {
    if (warningTimer.current)      clearTimeout(warningTimer.current);
    if (logoutTimer.current)       clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  const startCountdown = useCallback(() => {
    const totalSeconds = Math.round((logoutMs - warningMs) / 1000);
    setSecondsLeft(totalSeconds);
    countdownInterval.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [logoutMs, warningMs]);

  const reset = useCallback(() => {
    if (!enabled) return;
    clearAll();
    setShowWarning(false);
    setSecondsLeft(Math.round((logoutMs - warningMs) / 1000));

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
      logoutTimer.current = setTimeout(() => {
        // Usa ref estável: não está nas dependências do useCallback
        onLogoutRef.current();
      }, logoutMs - warningMs);
    }, warningMs);
  // onLogoutRef intencionalmente ausente das deps — é um ref, não precisa
  }, [enabled, clearAll, warningMs, logoutMs, startCountdown]);

  const continueSession = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!enabled) return;
    const events  = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    reset();
    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [enabled, reset, clearAll]);

  return { showWarning, secondsLeft, continueSession };
}
