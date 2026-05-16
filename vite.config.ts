import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv captura arquivos .env locais; process.env captura o ambiente do servidor de build/deploy
  const env = loadEnv(mode, process.cwd(), '');

  const appSupabaseUrl = process.env.APP_SUPABASE_URL || env.APP_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const appSupabaseKey = process.env.APP_SUPABASE_KEY || env.APP_SUPABASE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      'import.meta.env.APP_SUPABASE_URL': JSON.stringify(appSupabaseUrl),
      'import.meta.env.APP_SUPABASE_KEY': JSON.stringify(appSupabaseKey),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
