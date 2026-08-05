(function () {
  try {
    const saved = sessionStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    // CRÍTICO: precisa das duas linhas abaixo
    document.documentElement.classList.remove("dark", "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch {
    // Falha de storage não deve impedir a inicialização da aplicação.
  }
})();

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Pilar 1 & 3 ─ Monitoring bootstrap ───────────────────────────────────────
import { initConnectionMonitor, initGlobalErrorHandlers } from "./lib/error-interceptor";

let stopMonitoring = () => {};
let monitoringDisposed = false;
const stopConnMonitor   = initConnectionMonitor();
const stopErrorHandlers = initGlobalErrorHandlers();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    monitoringDisposed = true;
    stopMonitoring();
    stopConnMonitor();
    stopErrorHandlers();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️  StrictMode desabilitado em PRODUÇÃO.
 *
 * O React.StrictMode monta/desmonta cada componente 2× em desenvolvimento
 * para detectar efeitos colaterais — comportamento útil em dev, mas que
 * dobra os useEffects e as requisições ao Supabase em produção se esquecido.
 *
 * Mantemos StrictMode ativo apenas em desenvolvimento (import.meta.env.DEV).
 * Em produção o render é direto, sem dupla montagem.
 */
const app = <App />;

if (import.meta.env.DEV) {
  const { StrictMode } = await import("react");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{app}</StrictMode>
  );
} else {
  createRoot(document.getElementById("root")!).render(app);
}

// Observabilidade não bloqueia a primeira renderização. O chunk do Sentry,
// tracing e replay é carregado em paralelo somente após o bootstrap visual.
void import("./lib/monitoring")
  .then(({ initMonitoring }) => {
    if (monitoringDisposed) return;
    stopMonitoring = initMonitoring();
  })
  .catch((error: unknown) => {
    console.warn("[Monitoring] Não foi possível inicializar a observabilidade.", error);
  });
