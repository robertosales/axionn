const CHUNK_RELOAD_PREFIX = "axionn:chunk-reload";

const CHUNK_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  return String(error ?? "").toLowerCase();
}

export function isChunkLoadError(error: unknown): boolean {
  const message = errorMessage(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function chunkReloadKey(version: string, path: string): string {
  return `${CHUNK_RELOAD_PREFIX}:${version}:${path}`;
}

export function claimChunkReload(
  storage: Pick<Storage, "getItem" | "setItem">,
  version: string,
  path: string,
): boolean {
  const key = chunkReloadKey(version, path);
  if (storage.getItem(key)) return false;

  storage.setItem(key, new Date().toISOString());
  return true;
}

export function clearChunkReloadClaim(
  storage: Pick<Storage, "removeItem">,
  version: string,
  path: string,
): void {
  storage.removeItem(chunkReloadKey(version, path));
}

export function installChunkRecovery(version = import.meta.env.VITE_APP_VERSION ?? "unknown"): () => void {
  const onPreloadError = (event: Event) => {
    const error = (event as Event & { payload?: unknown }).payload;
    if (error && !isChunkLoadError(error)) return;

    try {
      if (!claimChunkReload(sessionStorage, version, window.location.pathname)) return;
      event.preventDefault();
      window.location.reload();
    } catch {
      // Storage indisponível: a rejeição segue para o Error Boundary, sem risco de loop.
    }
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}

export function retryApplication(version = import.meta.env.VITE_APP_VERSION ?? "unknown"): void {
  try {
    clearChunkReloadClaim(sessionStorage, version, window.location.pathname);
  } catch {
    // A recarga manual continua útil mesmo quando o storage está bloqueado.
  }
  window.location.reload();
}
