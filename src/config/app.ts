/**
 * Constantes globais do aplicativo.
 *
 * APP_VERSION   — lida automaticamente do campo "version" em package.json.
 *                 Para publicar uma nova versão basta rodar:
 *                   npm version patch   (ou minor / major)
 *                 O próximo build já reflete o novo número.
 *
 * APP_BUILD_DATE — injetada pelo Vite no momento do `vite build`
 *                   como a data local do servidor de CI (formato DD/MM/YYYY).
 *                   Em `vite dev` mostra a data atual do browser como fallback.
 */

export const APP_NAME      = "Axion";
export const APP_TAGLINE   = "Operações & Fluxo Ágil";
export const APP_FULL_NAME = "Axion – Operações e Fluxo Ágil";

/** Versão semântica injetada em build-time a partir do package.json */
export const APP_VERSION: string =
  import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/** Data do último build no formato DD/MM/YYYY */
export const APP_BUILD_DATE: string =
  import.meta.env.VITE_APP_BUILD_DATE ??
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
