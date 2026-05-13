import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      // Mapeia variáveis APP_* para ficarem acessíveis via import.meta.env
      'import.meta.env.APP_SUPABASE_URL': JSON.stringify(env.APP_SUPABASE_URL || ''),
      'import.meta.env.APP_SUPABASE_KEY': JSON.stringify(env.APP_SUPABASE_KEY || ''),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
