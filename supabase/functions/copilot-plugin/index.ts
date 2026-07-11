// Copilot Plugin — Edge Function (MVP scaffold)
//
// Variáveis de ambiente necessárias:
//   COPILOT_PLUGIN_TOKEN  — token bearer usado para autenticar chamadas do Copilot
//   SUPABASE_URL          — URL do projeto Supabase (injetada automaticamente)
//   SUPABASE_ANON_KEY     — chave anon (injetada automaticamente)
//
// Rotas (relativas à raiz da function):
//   GET  /health
//   GET  /manifest
//   POST /chat
//   POST /actions/summarize-project
//   POST /actions/query-metrics

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const VERSION = "0.1.0";
const FUNCTION_NAME = "copilot-plugin";

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  return json({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

function normalizePath(url: URL): string {
  // Remove o prefixo `/functions/v1/<name>` ao rodar em Supabase.
  let p = url.pathname;
  const marker = `/${FUNCTION_NAME}`;
  const idx = p.indexOf(marker);
  if (idx >= 0) p = p.slice(idx + marker.length);
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

function authenticate(req: Request): { ok: true } | { ok: false; response: Response } {
  const expected = Deno.env.get("COPILOT_PLUGIN_TOKEN");
  if (!expected) {
    return {
      ok: false,
      response: errorResponse(
        "server_misconfigured",
        "COPILOT_PLUGIN_TOKEN não configurado no ambiente.",
        500,
      ),
    };
  }
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      response: errorResponse("unauthorized", "Authorization Bearer token ausente.", 401),
    };
  }
  const token = header.slice(7).trim();
  if (token !== expected) {
    return {
      ok: false,
      response: errorResponse("unauthorized", "Token inválido.", 401),
    };
  }
  return { ok: true };
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw = await req.text();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function recordPluginHealth(
  context: {
    supabase: any;
    organizationId: string;
    projectId: string | null;
    integrationId: string | null;
  },
  event: {
    status: "healthy" | "degraded" | "unhealthy" | "unknown";
    correlationId: string;
    latencyMs: number;
    errorCode?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await context.supabase.from("integration_health_events").insert({
    organization_id: context.organizationId,
    project_id: context.projectId,
    provider: "copilot-plugin",
    integration_id: context.integrationId,
    check_type: "plugin",
    status: event.status,
    latency_ms: event.latencyMs,
    error_code: event.errorCode ?? null,
    error_message: event.errorMessage ?? null,
    details: event.details ?? {},
    correlation_id: event.correlationId,
  });

  if (error) {
    console.error("[copilot-plugin] failed to record integration health:", error);
  }
}

function getSupabaseClient(req: Request): { client: any; organizationId: string; projectId: string | null; integrationId: string | null } | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !key) {
    return null;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const organizationId = req.headers.get("x-organization-id") ?? "";
  const projectId = req.headers.get("x-project-id") ?? null;
  const integrationId = req.headers.get("x-integration-id") ?? null;

  return {
    client,
    organizationId,
    projectId,
    integrationId,
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────

function handleHealth(): Response {
  return json({
    status: "ok",
    function: FUNCTION_NAME,
    version: VERSION,
    timestamp: new Date().toISOString(),
    capabilities: ["chat", "summarize-project", "query-metrics"],
    authenticated: true,
  });
}

function handleManifest(): Response {
  return json({
    name: "Axionn Copilot Plugin",
    description:
      "Plugin backend do Axionn para integração com GitHub Copilot. Permite resumir contexto e consultar métricas do projeto.",
    version: VERSION,
    auth: { type: "bearer", header: "Authorization" },
    security: {
      required: true,
      tokenEnv: "COPILOT_PLUGIN_TOKEN",
    },
    endpoints: [
      { method: "GET", path: "/health", description: "Status da function." },
      { method: "GET", path: "/manifest", description: "Metadados do plugin." },
      { method: "POST", path: "/chat", description: "Envia mensagem ao plugin e recebe resposta estruturada." },
      { method: "POST", path: "/actions/summarize-project", description: "Resume o contexto do projeto Axionn." },
      { method: "POST", path: "/actions/query-metrics", description: "Consulta métricas/indicadores do Axionn." },
    ],
  });
}

async function handleChat(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return errorResponse("invalid_json", "Corpo da requisição não é JSON válido.", 400);

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return errorResponse("invalid_input", "Campo 'message' é obrigatório (string).", 400);
  }

  return json({
    answer: `Recebi sua mensagem: "${message}". Este é um scaffold inicial do Axionn Copilot Plugin — respostas reais serão integradas em breve.`,
    sources: [],
    actions: [
      { id: "summarize-project", label: "Resumir projeto", path: "/actions/summarize-project" },
      { id: "query-metrics", label: "Consultar métricas", path: "/actions/query-metrics" },
    ],
    metadata: {
      function: FUNCTION_NAME,
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleSummarizeProject(req: Request): Promise<Response> {
  const body = (await readJson(req)) ?? {};
  const projectId = typeof body.projectId === "string" ? body.projectId : null;

  return json({
    answer:
      "Resumo mockado do projeto Axionn. Fase atual: SaaS Phase 2b. Módulos ativos: Sala Ágil, Sustentação, Backoffice. Integração real será conectada em iteração futura.",
    sources: projectId ? [{ type: "project", id: projectId }] : [],
    actions: [],
    metadata: {
      function: FUNCTION_NAME,
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleQueryMetrics(req: Request): Promise<Response> {
  const body = (await readJson(req)) ?? {};
  const metric = typeof body.metric === "string" ? body.metric : "overview";

  return json({
    answer: `Consulta de métricas '${metric}' recebida. Camada de dados ainda mockada.`,
    sources: [],
    actions: [],
    data: {
      metric,
      generatedAt: new Date().toISOString(),
      values: [
        { label: "Demandas abertas", value: 0 },
        { label: "SLA médio", value: null },
        { label: "Sprints ativas", value: 0 },
      ],
    },
    metadata: {
      function: FUNCTION_NAME,
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
  });
}

// ── Router ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  const context = getSupabaseClient(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = normalizePath(url);
    const method = req.method.toUpperCase();

    if (method === "GET" && path === "/health") {
      if (context) {
        await recordPluginHealth(
          {
            supabase: context.client,
            organizationId: context.organizationId,
            projectId: context.projectId,
            integrationId: context.integrationId,
          },
          {
            status: "healthy",
            correlationId,
            latencyMs: Date.now() - startTime,
            details: { route: "/health" },
          },
        );
      }
      return handleHealth();
    }

    const auth = authenticate(req);
    if (!auth.ok) {
      if (context) {
        await recordPluginHealth(
          {
            supabase: context.client,
            organizationId: context.organizationId,
            projectId: context.projectId,
            integrationId: context.integrationId,
          },
          {
            status: "degraded",
            correlationId,
            latencyMs: Date.now() - startTime,
            errorCode: "UNAUTHORIZED",
            errorMessage: "Authorization Bearer token ausente ou inválido.",
            details: { route: path, method },
          },
        );
      }
      return auth.response;
    }

    let response: Response;
    if (method === "GET" && path === "/manifest") {
      response = handleManifest();
    } else if (method === "POST" && path === "/chat") {
      response = await handleChat(req);
    } else if (method === "POST" && path === "/actions/summarize-project") {
      response = await handleSummarizeProject(req);
    } else if (method === "POST" && path === "/actions/query-metrics") {
      response = await handleQueryMetrics(req);
    } else {
      response = errorResponse("not_found", `Rota não encontrada: ${method} ${path}`, 404);
    }

    if (context && response.status >= 400) {
      await recordPluginHealth(
        {
          supabase: context.client,
          organizationId: context.organizationId,
          projectId: context.projectId,
          integrationId: context.integrationId,
        },
        {
          status: response.status >= 500 ? "unhealthy" : "degraded",
          correlationId,
          latencyMs: Date.now() - startTime,
          errorCode: response.status === 404 ? "NOT_FOUND" : "REQUEST_ERROR",
          errorMessage: response.statusText || "Erro na requisição do plugin.",
          details: { route: path, method, status: response.status },
        },
      );
    } else if (context) {
      await recordPluginHealth(
        {
          supabase: context.client,
          organizationId: context.organizationId,
          projectId: context.projectId,
          integrationId: context.integrationId,
        },
        {
          status: "healthy",
          correlationId,
          latencyMs: Date.now() - startTime,
          details: { route: path, method, status: response.status },
        },
      );
    }

    return response;
  } catch (err) {
    console.error("[copilot-plugin] erro inesperado:", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    if (context) {
      await recordPluginHealth(
        {
          supabase: context.client,
          organizationId: context.organizationId,
          projectId: context.projectId,
          integrationId: context.integrationId,
        },
        {
          status: "unhealthy",
          correlationId,
          latencyMs: Date.now() - startTime,
          errorCode: "INTERNAL_ERROR",
          errorMessage: message,
          details: { route: "*", method: req.method.toUpperCase() },
        },
      );
    }
    return errorResponse("internal_error", message, 500);
  }
});