(function () {
  try {
    const saved = sessionStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    // CRÍTICO: precisa das duas linhas abaixo
    document.documentElement.classList.remove("dark", "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch {}
})();

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";

// ── Pilar 1 & 3 ─ Monitoring bootstrap ───────────────────────────────────────
import { initMonitoring } from "./lib/monitoring";
import { initConnectionMonitor, initGlobalErrorHandlers } from "./lib/error-interceptor";

// Inicia APM (Sentry + Web Vitals + Memory Monitor + Long Task Observer)
const stopMonitoring     = initMonitoring();
// Inicia monitor de rede (online/offline → Sentry)
const stopConnMonitor    = initConnectionMonitor();
// Inicia captura global de erros não tratados (uncaught + unhandledrejection)
const stopErrorHandlers  = initGlobalErrorHandlers();

// Cleanup ao desmontar a aplicação (HMR / testes)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopMonitoring();
    stopConnMonitor();
    stopErrorHandlers();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
