type OutboundUrlOptions = {
  allowedHosts?: Iterable<string>;
  allowedHostSuffixes?: Iterable<string>;
};

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

export function hostsFromEnv(name: string, defaults: string[] = []): string[] {
  return [...defaults, ...(Deno.env.get(name) ?? "").split(",")]
    .map(normalizeHost)
    .filter(Boolean);
}

function isForbiddenLiteralHost(hostname: string): boolean {
  if (["localhost", "0.0.0.0", "::", "::1"].includes(hostname)) return true;
  if (hostname.endsWith(".localhost") || hostname.endsWith(".local")
    || hostname.endsWith(".internal")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return true;
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127);
  }

  // Block literal IPv6. External services must use an allowlisted DNS name;
  // this avoids alternative textual encodings of loopback/private ranges.
  return hostname.includes(":");
}

export function assertSafeOutboundUrl(
  rawUrl: string,
  options: OutboundUrlOptions = {},
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("OUTBOUND_URL_INVALID");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("OUTBOUND_URL_NOT_ALLOWED");
  }
  if (url.port && url.port !== "443") throw new Error("OUTBOUND_PORT_NOT_ALLOWED");

  const hostname = normalizeHost(url.hostname);
  if (isForbiddenLiteralHost(hostname)) throw new Error("OUTBOUND_HOST_NOT_ALLOWED");

  const allowedHosts = [...(options.allowedHosts ?? [])].map(normalizeHost);
  const allowedSuffixes = [...(options.allowedHostSuffixes ?? [])]
    .map(normalizeHost)
    .filter(Boolean);
  const allowed = allowedHosts.includes(hostname)
    || allowedSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  if (!allowed) throw new Error("OUTBOUND_HOST_NOT_ALLOWLISTED");
  return url;
}
