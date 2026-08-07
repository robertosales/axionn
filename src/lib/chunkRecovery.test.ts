import { describe, expect, it } from "vitest";

import {
  chunkReloadKey,
  claimChunkReload,
  clearChunkReloadClaim,
  isChunkLoadError,
} from "./chunkRecovery";

describe("chunk recovery", () => {
  it.each([
    new Error("Failed to fetch dynamically imported module"),
    new Error("Loading chunk 42 failed"),
    { toString: () => "ChunkLoadError" },
  ])("recognizes stale deployment errors", (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("does not classify an ordinary application error as a chunk failure", () => {
    expect(isChunkLoadError(new Error("Validation failed"))).toBe(false);
  });

  it("allows only one automatic reload for each version and route", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    expect(claimChunkReload(storage, "1.3.8", "/backoffice")).toBe(true);
    expect(claimChunkReload(storage, "1.3.8", "/backoffice")).toBe(false);
    expect(claimChunkReload(storage, "1.3.9", "/backoffice")).toBe(true);

    clearChunkReloadClaim(storage, "1.3.8", "/backoffice");
    expect(values.has(chunkReloadKey("1.3.8", "/backoffice"))).toBe(false);
    expect(claimChunkReload(storage, "1.3.8", "/backoffice")).toBe(true);
  });
});
