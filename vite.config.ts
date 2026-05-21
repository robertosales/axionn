import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Instale para análise de bundle:
// npm install --save-dev rollup-plugin-visualizer
let visualizer: any = null;
try {
  // Importação dinâmica para não quebrar se não estiver instalado
  visualizer = require("rollup-plugin-visualizer").visualizer;
} catch {}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProduction = mode === "production";
  const isAnalyze = process.env.ANALYZE === "true";

  const appSupabaseUrl =
    process.env.APP_SUPABASE_URL ||
    env.APP_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    "";
  const appSupabaseKey =
    process.env.APP_SUPABASE_KEY ||
    env.APP_SUPABASE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },

    define: {
      "import.meta.env.APP_SUPABASE_URL": JSON.stringify(appSupabaseUrl),
      "import.meta.env.APP_SUPABASE_KEY": JSON.stringify(appSupabaseKey),
    },

    plugins: [
      react(),
      // Gera stats.html após build quando ANALYZE=true
      ...(isAnalyze && visualizer
        ? [
            visualizer({
              filename: "dist/stats.html",
              open: true,
              gzipSize: true,
              brotliSize: true,
              template: "treemap",
            }),
          ]
        : []),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      // Alvo moderno — elimina polyfills desnecessários
      target: "es2020",

      // Avisa apenas acima de 800 KB (chunks individuais)
      chunkSizeWarningLimit: 800,

      // Minificação agressiva em produção
      minify: isProduction ? "terser" : false,
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ["console.log", "console.info", "console.warn"],
            },
          }
        : undefined,

      rollupOptions: {
        output: {
          /**
           * manualChunks — divide o bundle em chunks lógicos:
           *
           * react-core    → react, react-dom (< 150 KB gz)
           * router        → react-router-dom
           * vendor        → tanstack/react-query, sonner, date-fns, zod
           * ui            → radix-ui + shadcn (lucide-react incluído)
           * dnd           → @dnd-kit (usado só no Kanban)
           * supabase      → @supabase/supabase-js (carregado 1x)
           * charts        → recharts / chart libs (pesadas, lazy mesmo)
           * feature-*     → código de cada módulo de negócio
           */
          manualChunks(id: string) {
            // ── Supabase ───────────────────────────────────────────────
            if (id.includes("node_modules/@supabase")) {
              return "supabase";
            }

            // ── DnD Kit (usado só no Kanban) ───────────────────────────
            if (id.includes("node_modules/@dnd-kit")) {
              return "dnd";
            }

            // ── Charts / Recharts ──────────────────────────────────────
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3") ||
              id.includes("node_modules/victory")
            ) {
              return "charts";
            }

            // ── Vendor genérico ────────────────────────────────────────
            if (
              id.includes("node_modules/@tanstack") ||
              id.includes("node_modules/sonner") ||
              id.includes("node_modules/date-fns") ||
              id.includes("node_modules/zod") ||
              id.includes("node_modules/uuid")
            ) {
              return "vendor";
            }

            // ── Features por módulo de negócio ─────────────────────────
            if (id.includes("/src/features/sustentacao")) return "feature-sustentacao";
            if (id.includes("/src/features/rdm"))         return "feature-rdm";
            if (id.includes("/src/features/apf"))         return "feature-apf";

            // Sala Ágil: componentes pesados em chunk próprio
            if (
              id.includes("/src/components/MetricsDashboard") ||
              id.includes("/src/components/AgileHistory") ||
              id.includes("/src/components/PlanningPoker") ||
              id.includes("/src/components/RetroManager") ||
              id.includes("/src/components/CalendarView")
            ) {
              return "feature-sala-agil-heavy";
            }
          },
        },
      },
    },
  };
});
