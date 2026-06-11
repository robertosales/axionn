/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versão SemVer injetada pelo vite.config.ts a partir do package.json */
  readonly VITE_APP_VERSION: string;
  /** Data do build no formato DD/MM/YYYY injetada pelo vite.config.ts */
  readonly VITE_APP_BUILD_DATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
