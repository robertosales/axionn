import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Leitura em build-time: version do package.json e data atual
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

const buildDate = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function stableVendorChunk(moduleId: string): string | undefined {
  const id = moduleId.replace(/\\/g, "/");
  if (!id.includes("/node_modules/")) return undefined;

  if (
    id.includes("/node_modules/react/") ||
    id.includes("/node_modules/react-dom/") ||
    id.includes("/node_modules/react-router") ||
    id.includes("/node_modules/@remix-run/") ||
    id.includes("/node_modules/scheduler/")
  ) return "vendor-react";

  if (id.includes("/node_modules/@supabase/")) return "vendor-supabase";
  if (id.includes("/node_modules/@tanstack/")) return "vendor-query";
  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Enforcement de MFA no Backoffice: em produção o padrão é obrigatório,
  // salvo se a variável for explicitamente definida (rollback = "false").
  const backofficeMfaRequired =
    env.VITE_BACKOFFICE_MFA_REQUIRED ?? (mode === "production" ? "true" : "false");

  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Substitui literalmente no bundle — tree-shakeable e sem overhead de runtime
    "import.meta.env.VITE_APP_VERSION":    JSON.stringify(version),
    "import.meta.env.VITE_APP_BUILD_DATE": JSON.stringify(buildDate),
    "import.meta.env.VITE_BACKOFFICE_MFA_REQUIRED": JSON.stringify(backofficeMfaRequired),
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: stableVendorChunk,
      },
    },
  },
  };
});
