interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

const PRODUCTION_HOSTS = new Set(["axionn.app", "www.axionn.app"]);

// Both values are public browser configuration. Never add service-role keys here.
const AXIONN_PRODUCTION_SUPABASE: SupabasePublicConfig = {
  url: "https://rgikyyazotqapaxijwui.supabase.co",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg",
};

/**
 * Recovery configuration for the canonical production hostname only.
 * Preview, development and third-party deployments must provide their own env.
 */
export function getCanonicalProductionSupabaseConfig(
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
): SupabasePublicConfig | undefined {
  return PRODUCTION_HOSTS.has(hostname.trim().toLowerCase())
    ? AXIONN_PRODUCTION_SUPABASE
    : undefined;
}
