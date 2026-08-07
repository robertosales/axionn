import { createClient } from "npm:@supabase/supabase-js@2";
import { readJsonBody, RequestBodyTooLargeError } from "../_shared/request-body.ts";

const VERSION = "0.2.0";
const FUNCTION_NAME = "copilot-plugin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, content-type, x-plugin-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const errorResponse = (code: string, message: string, status: number) =>
  json({ error: { code, message } }, status);

function normalizePath(url: URL): string {
  let path = url.pathname;
  const marker = `/${FUNCTION_NAME}`;
  const index = path.indexOf(marker);
  if (index >= 0) path = path.slice(index + marker.length);
  if (!path.startsWith("/")) path = `/${path}`;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function authenticate(req: Request): Promise<Response | null> {
  const expected = Deno.env.get("COPILOT_PLUGIN_TOKEN")?.trim();
  if (!expected) return errorResponse("server_misconfigured", "Autenticação do plugin não configurada.", 503);
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return errorResponse("unauthorized", "Authorization Bearer token ausente.", 401);
  }
  const valid = await tokenMatches(authorization.slice(7).trim(), expected);
  return valid ? null : errorResponse("unauthorized", "Token inválido.", 401);
}

type PluginContext = {
  admin: ReturnType<typeof createClient>;
  pluginId: string;
  organizationId: string;
  projectId: string | null;
};

async function resolvePluginContext(req: Request): Promise<PluginContext | Response> {
  const pluginId = req.headers.get("x-plugin-id")?.trim() ?? "";
  if (!UUID.test(pluginId)) return errorResponse("plugin_id_required", "x-plugin-id inválido ou ausente.", 400);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return errorResponse("server_misconfigured", "Persistência do plugin não configurada.", 503);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: plugin, error } = await admin
    .from("copilot_plugins")
    .select("id, organization_id, project_id")
    .eq("id", pluginId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return errorResponse("plugin_lookup_failed", "Não foi possível validar o plugin.", 500);
  if (!plugin) return errorResponse("plugin_not_found", "Plugin ativo não encontrado.", 404);

  return {
    admin,
    pluginId: plugin.id,
    organizationId: plugin.organization_id,
    projectId: plugin.project_id,
  };
}

async function recordHealth(context: PluginContext, status: "healthy" | "degraded" | "unhealthy", details: Record<string, unknown>) {
  const { error } = await context.admin.from("integration_health_events").insert({
    organization_id: context.organizationId,
    project_id: context.projectId,
    provider: "copilot-plugin",
    integration_id: context.pluginId,
    check_type: "plugin",
    status,
    details,
    correlation_id: details.correlationId,
  });
  if (error) console.error("[copilot-plugin] health persistence failed");
}

function handleHealth(): Response {
  return json({
    status: "ok",
    function: FUNCTION_NAME,
    version: VERSION,
    capabilities: [],
    timestamp: new Date().toISOString(),
  });
}

function handleManifest(): Response {
  return json({
    name: "Axionn Copilot Plugin",
    version: VERSION,
    auth: { type: "bearer", header: "Authorization" },
    capabilities: [],
    endpoints: [
      { method: "GET", path: "/health", status: "available" },
      { method: "GET", path: "/manifest", status: "available" },
      { method: "POST", path: "/chat", status: "not_implemented" },
      { method: "POST", path: "/actions/summarize-project", status: "not_implemented" },
      { method: "POST", path: "/actions/query-metrics", status: "not_implemented" },
    ],
  });
}

async function unavailableCapability(req: Request): Promise<Response> {
  try {
    await readJsonBody<Record<string, unknown>>(req, 64_000);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse("request_too_large", "Payload excede 64 KB.", 413);
    if (error instanceof SyntaxError) return errorResponse("invalid_json", "Corpo JSON inválido.", 400);
    throw error;
  }
  return errorResponse(
    "capability_not_implemented",
    "Esta capacidade ainda não está disponível; nenhum dado fictício foi retornado.",
    501,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const path = normalizePath(new URL(req.url));
  const method = req.method.toUpperCase();
  if (method === "GET" && path === "/health") return handleHealth();

  const authError = await authenticate(req);
  if (authError) return authError;

  const resolved = await resolvePluginContext(req);
  if (resolved instanceof Response) return resolved;
  const context = resolved;
  const correlationId = crypto.randomUUID();

  try {
    let response: Response;
    if (method === "GET" && path === "/manifest") response = handleManifest();
    else if (method === "POST" && [
      "/chat",
      "/actions/summarize-project",
      "/actions/query-metrics",
    ].includes(path)) response = await unavailableCapability(req);
    else response = errorResponse("not_found", "Rota não encontrada.", 404);

    await recordHealth(context, response.status < 400 ? "healthy" : "degraded", {
      correlationId,
      route: path,
      method,
      status: response.status,
    });
    return response;
  } catch {
    await recordHealth(context, "unhealthy", { correlationId, route: path, method });
    return errorResponse("internal_error", "Erro interno.", 500);
  }
});
