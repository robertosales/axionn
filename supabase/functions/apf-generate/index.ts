import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * The wrapped legacy module remains responsible for these enforced controls:
 * AI_USAGE_ENFORCEMENT_MODE, reserve_ai_usage, finalize_ai_usage and
 * AI_MAX_PROMPT_CHARS. This entrypoint adds platform-admin authorization and
 * response sanitization without bypassing the existing governance pipeline.
 */

type LegacyHandler = (
  request: Request,
  info?: Deno.ServeHandlerInfo,
) => Response | Promise<Response>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const originalServe = Deno.serve.bind(Deno);
let legacyHandler: LegacyHandler | null = null;

(Deno as unknown as { serve: (...args: unknown[]) => unknown }).serve = (
  ...args: unknown[]
) => {
  const candidate = typeof args[0] === "function" ? args[0] : args[1];
  if (typeof candidate !== "function") {
    throw new Error("apf_generate_handler_not_found");
  }
  legacyHandler = candidate as LegacyHandler;
  return {
    finished: Promise.resolve(),
    shutdown: async (): Promise<void> => undefined,
    ref: (): void => undefined,
    unref: (): void => undefined,
  };
};

await import("./legacy.ts");
(Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;

if (!legacyHandler) {
  throw new Error("apf_generate_handler_not_captured");
}

function jsonResponse(payload: unknown, status: number, request: Request) {
  const origin = Deno.env.get("SITE_URL") ?? request.headers.get("origin") ?? "*";
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, " +
        "x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function isPlatformAdmin(authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (SERVICE_KEY && token === SERVICE_KEY) {
    return { allowed: true, serviceRole: true };
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return { allowed: false, serviceRole: false };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await admin
    .from("platform_user_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .maybeSingle();

  if (error) {
    console.error("[apf-generate] platform role validation failed", error.message);
    return { allowed: false, serviceRole: false };
  }

  return { allowed: Boolean(data), serviceRole: false };
}

function cloneRequest(
  request: Request,
  body: Record<string, unknown> | null,
  authorization?: string,
) {
  const headers = new Headers(request.headers);
  if (authorization) headers.set("Authorization", authorization);

  return new Request(request.url, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD" || body === null
        ? undefined
        : JSON.stringify(body),
    redirect: request.redirect,
    signal: request.signal,
  });
}

async function sanitizeTestResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object") {
      delete (payload as Record<string, unknown>).rawError;
    }
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

originalServe(async (request: Request, info: Deno.ServeHandlerInfo) => {
  if (request.method === "OPTIONS") {
    return legacyHandler!(request, info);
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const body = request.method === "POST"
    ? await request.clone().json().catch(() => ({} as Record<string, unknown>))
    : null;
  const requestBody = body && typeof body === "object"
    ? { ...(body as Record<string, unknown>) }
    : null;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleRequest = Boolean(SERVICE_KEY && token === SERVICE_KEY);
  const testMode = requestBody?.testMode === true;

  if (requestBody && !serviceRoleRequest) {
    delete requestBody.apiKey;
    delete requestBody.provider;
    delete requestBody.model;
  }

  if (!testMode) {
    return legacyHandler!(cloneRequest(request, requestBody), info);
  }

  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autenticado" }, 401, request);
  }

  const authorization = await isPlatformAdmin(authHeader);
  if (!authorization.allowed) {
    return jsonResponse(
      { error: "Teste de provedor restrito à administração da plataforma" },
      403,
      request,
    );
  }

  const forwarded = cloneRequest(
    request,
    requestBody,
    `Bearer ${SERVICE_KEY}`,
  );
  const response = await legacyHandler!(forwarded, info);
  return sanitizeTestResponse(response);
});
