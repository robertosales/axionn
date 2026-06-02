import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { readFileSync } from "fs";

// Lê versão diretamente do package.json — fonte da verdade
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export default defineConfig(({ mode }) => ({
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
    // Injetadas em build-time; tree-shaken em produção.
    // Acesso via import.meta.env.VITE_APP_VERSION etc.
    "import.meta.env.VITE_APP_VERSION":    JSON.stringify(pkg.version),
    "import.meta.env.VITE_APP_BUILD_DATE": JSON.stringify(
      new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    ),
  },
}));
