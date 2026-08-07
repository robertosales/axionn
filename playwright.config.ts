import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const e2eEnvironmentKeys = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "E2E_ORGANIZATION_ID",
] as const;

if (existsSync(".env.e2e")) {
  const allowedKeys = new Set<string>(e2eEnvironmentKeys);
  for (const line of readFileSync(".env.e2e", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (!allowedKeys.has(key) || process.env[key]) continue;

    const rawValue = line.slice(separator + 1).trim();
    const isQuoted =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")));
    process.env[key] = isQuoted ? rawValue.slice(1, -1) : rawValue;
  }
}

const useLocalApp = process.env.E2E_USE_LOCAL_APP === "true";
const localAppURL = "http://127.0.0.1:4173";
const baseURL = useLocalApp
  ? localAppURL
  : process.env.E2E_BASE_URL ?? localAppURL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    // Traces can retain form and network payloads from authentication.
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useLocalApp || !process.env.E2E_BASE_URL
    ? {
        command: "npm.cmd run dev -- --mode production --host 127.0.0.1 --port 4173",
        url: localAppURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
