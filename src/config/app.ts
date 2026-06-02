// src/config/app.ts
// ⚠️  Não edite APP_VERSION nem APP_BUILD_DATE manualmente.
//     São injetadas em build-time pelo Vite a partir do package.json.
//     Para publicar uma nova versão use:
//       npm run release:patch   → 1.2.0 → 1.2.1
//       npm run release:minor   → 1.2.0 → 1.3.0
//       npm run release:major   → 1.2.0 → 2.0.0
//     Ou crie uma tag git: git tag v1.3.0 && git push origin v1.3.0

export const APP_NAME      = "Axion";
export const APP_TAGLINE   = "Operações & Fluxo Ágil";
export const APP_FULL_NAME = "Axion – Operações e Fluxo Ágil";

/**
 * Versão injetada pelo Vite em build-time (package.json → define).
 * Em dev (vite dev) o fallback garante que não aparece "undefined".
 */
export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

export const APP_BUILD_DATE: string =
  (import.meta.env.VITE_APP_BUILD_DATE as string | undefined) ??
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
