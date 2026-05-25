import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// rollup-plugin-visualizer: gera stats.html com análise visual do bundle
// Execute `npm run build` e abra `dist/stats.html` para visualizar
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Gera dist/stats.html com o mapa visual do bundle — apenas em produção
    mode === "production" &&
      visualizer({
        filename: "dist/stats.html",
        open: false,       // não abre automaticamente; acesse manualmente
        gzipSize: true,    // exibe tamanho gzip real
        brotliSize: true,  // exibe tamanho brotli
        template: "treemap", // treemap | sunburst | network
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
