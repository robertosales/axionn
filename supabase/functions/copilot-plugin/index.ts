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

function errorResponse(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
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

// ── Handlers ────────────────────────────────────────────────────────────────

function handleHealth(): Response {
  return json({
    status: "ok",
    function: FUNCTION_NAME,
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
}

function handleManifest(): Response {
  return json({
    name: "Axionn Copilot Plugin",
    description:
      "Plugin backend do Axionn para integração com GitHub Copilot. Permite resumir contexto e consultar métricas do projeto.",
    version: VERSION,
    auth: { type: "bearer", header: "Authorization" },
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
  });
}

// ── Router ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = normalizePath(url);
    const method = req.method.toUpperCase();

    // Rotas públicas
    if (method === "GET" && path === "/health") return handleHealth();

    // A partir daqui, exige autenticação
    const auth = authenticate(req);
    if (!auth.ok) return auth.response;

    if (method === "GET" && path === "/manifest") return handleManifest();
    if (method === "POST" && path === "/chat") return handleChat(req);
    if (method === "POST" && path === "/actions/summarize-project") {
      return handleSummarizeProject(req);
    }
    if (method === "POST" && path === "/actions/query-metrics") {
      return handleQueryMetrics(req);
    }

    return errorResponse("not_found", `Rota não encontrada: ${method} ${path}`, 404);
  } catch (err) {
    console.error("[copilot-plugin] erro inesperado:", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    return errorResponse("internal_error", message, 500);
  }
});