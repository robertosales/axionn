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

// Fallback publico do Supabase (URL + publishable/anon key sao publicos por
// design; a protecao dos dados e feita por RLS). Necessario porque o arquivo
// .env e ignorado pelo git e nao existe no ambiente de build/publish.
const FALLBACK_SUPABASE_URL = "https://rgikyyazotqapaxijwui.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

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
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
  },
  };
});
