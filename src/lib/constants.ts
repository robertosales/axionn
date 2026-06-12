export const APP_NAME      = "Axion";
export const APP_TAGLINE   = "Operações & Fluxo Ágil";
export const APP_FULL_NAME = "Axion – Operações e Fluxo Ágil";

/**
 * Versão semântica injetada em build-time a partir do package.json via Vite.
 * Para publicar uma nova versão, rode: npm version patch | minor | major
 * O próximo build já reflete o novo número automaticamente.
 */
export const APP_VERSION: string =
  import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/** Data do último build no formato DD/MM/YYYY, injetada pelo Vite em build-time. */
export const APP_BUILD_DATE: string =
  import.meta.env.VITE_APP_BUILD_DATE ??
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
