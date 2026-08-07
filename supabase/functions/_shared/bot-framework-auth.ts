import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const BOT_OPENID_CONFIGURATION =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";
const BOT_CONNECTOR_ISSUER = "https://api.botframework.com";

let remoteKeys: ReturnType<typeof createRemoteJWKSet> | null = null;

async function signingKeys() {
  if (remoteKeys) return remoteKeys;
  const response = await fetch(BOT_OPENID_CONFIGURATION, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("BOT_OPENID_CONFIGURATION_UNAVAILABLE");
  const metadata = await response.json() as { jwks_uri?: string };
  if (!metadata.jwks_uri?.startsWith("https://")) {
    throw new Error("BOT_OPENID_CONFIGURATION_INVALID");
  }
  remoteKeys = createRemoteJWKSet(new URL(metadata.jwks_uri));
  return remoteKeys;
}

export async function verifyBotFrameworkRequest(request: Request): Promise<void> {
  const appId =
    Deno.env.get("TEAMS_BOT_APP_ID")?.trim() ||
    Deno.env.get("TEAMS_CLIENT_ID")?.trim();
  if (!appId) throw new Error("TEAMS_BOT_APP_ID_NOT_CONFIGURED");

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("BOT_AUTHORIZATION_MISSING");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("BOT_AUTHORIZATION_MISSING");

  await jwtVerify(token, await signingKeys(), {
    algorithms: ["RS256"],
    issuer: BOT_CONNECTOR_ISSUER,
    audience: appId,
    clockTolerance: 60,
  });
}
