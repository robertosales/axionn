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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isTest = mode === "test";
  const supabaseUrl = env.VITE_SUPABASE_URL || (isTest ? "https://test.supabase.invalid" : "");
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    (isTest ? "test-publishable-key" : "");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Configuração Supabase ausente: defina VITE_SUPABASE_URL e " +
      "VITE_SUPABASE_PUBLISHABLE_KEY para este ambiente.",
    );
  }

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
