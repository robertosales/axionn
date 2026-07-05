import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PROVIDER_TIMEOUT_MS = Number(
  Deno.env.get("AI_PROVIDER_TEST_TIMEOUT_MS") ?? 30_000,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, " +
    "x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestFormat = "openai_compatible" | "gemini" | "anthropic";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  model: string | null;
  api_base_url: string | null;
  request_format: RequestFormat | null;
  is_active: boolean;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timeoutSignal() {
  return AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
}

function sanitizeProviderFailure(status: number) {
  if (status === 401 || status === 403) {
    return {
      reason: "AI_PROVIDER_AUTH",
      userMessage: "A chave configurada foi recusada pelo provedor.",
    };
  }
  if (status === 402) {
    return {
      reason: "AI_PROVIDER_PAYMENT_REQUIRED",
      userMessage: "O provedor está sem créditos ou com cobrança pendente.",
    };
  }
  if (status === 404) {
    return {
      reason: "AI_PROVIDER_MODEL_NOT_FOUND",
      userMessage: "O endpoint ou modelo configurado não foi encontrado.",
    };
  }
  if (status === 429) {
    return {
      reason: "AI_PROVIDER_RATE_LIMITED",
      userMessage: "O provedor limitou temporariamente as requisições.",
    };
  }
  if (status >= 500) {
    return {
      reason: "AI_PROVIDER_UNAVAILABLE",
      userMessage: "O provedor está temporariamente indisponível.",
    };
  }
  return {
    reason: "AI_PROVIDER_ERROR",
    userMessage: "O provedor não respondeu conforme esperado.",
  };
}

async function callProvider(provider: ProviderRow, apiKey: string) {
  const prompt = "Responda apenas com a palavra: OK";
  const format = provider.request_format ?? "openai_compatible";
  const model = provider.model ?? "";

  if (format === "gemini") {
    const resolvedModel = (model || "gemini-2.0-flash").replace(/^google\//, "");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: timeoutSignal(),
      },
    );
    if (!response.ok) return { ok: false as const, status: response.status };
    const data = await response.json();
    const sample = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return sample
      ? { ok: true as const, sample: String(sample) }
      : { ok: false as const, status: 502 };
  }

  if (format === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 16,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: timeoutSignal(),
    });
    if (!response.ok) return { ok: false as const, status: response.status };
    const data = await response.json();
    const sample = data?.content?.[0]?.text;
    return sample
      ? { ok: true as const, sample: String(sample) }
      : { ok: false as const, status: 502 };
  }

  if (!provider.api_base_url || !/^https:\/\//i.test(provider.api_base_url)) {
    return { ok: false as const, status: 422 };
  }
  if (!model) return { ok: false as const, status: 422 };

  const response = await fetch(provider.api_base_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16,
    }),
    signal: timeoutSignal(),
  });
  if (!response.ok) return { ok: false as const, status: response.status };
  const data = await response.json();
  const sample = data?.choices?.[0]?.message?.content;
  return sample
    ? { ok: true as const, sample: String(sample) }
    : { ok: false as const, status: 502 };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Token inválido" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: platformRole, error: roleError } = await admin
    .from("platform_user_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .maybeSingle();

  if (roleError) {
    console.error("[platform-ai-provider-test] role check failed", roleError.message);
    return jsonResponse({ error: "Não foi possível validar a autorização" }, 503);
  }
  if (!platformRole) {
    return jsonResponse({ error: "Acesso restrito à administração da plataforma" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  if (!UUID_REGEX.test(providerId)) {
    return jsonResponse({ error: "providerId inválido" }, 400);
  }

  const { data: providerData, error: providerError } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active")
    .eq("id", providerId)
    .maybeSingle();
  if (providerError) {
    console.error("[platform-ai-provider-test] provider lookup failed", providerError.message);
    return jsonResponse({ error: "Não foi possível carregar o provedor" }, 503);
  }
  if (!providerData || !providerData.is_active) {
    return jsonResponse({ error: "Provedor ativo não encontrado" }, 404);
  }

  const { data: keyData, error: keyError } = await admin.rpc(
    "get_ai_provider_key_by_id",
    { p_id: providerId },
  );
  if (keyError) {
    console.error("[platform-ai-provider-test] key lookup failed", keyError.message);
    return jsonResponse({ error: "Não foi possível acessar a chave configurada" }, 503);
  }
  if (typeof keyData !== "string" || keyData.trim().length < 10) {
    return jsonResponse({
      success: false,
      reason: "AI_PROVIDER_KEY_MISSING",
      userMessage: "O provedor não possui uma chave válida configurada.",
    });
  }

  const startedAt = Date.now();
  try {
    const provider = providerData as ProviderRow;
    const result = await callProvider(provider, keyData.trim());
    const latencyMs = Date.now() - startedAt;

    if (!result.ok) {
      const failure = sanitizeProviderFailure(result.status);
      return jsonResponse({ success: false, latencyMs, ...failure });
    }

    await admin.from("platform_operational_audit_log").insert({
      actor_id: user.id,
      action: "ai_provider_tested",
      resource_type: "ai_provider",
      resource_id: providerId,
      metadata: { success: true, latency_ms: latencyMs },
    });

    return jsonResponse({
      success: true,
      providerUsed: provider.name,
      providerType: provider.provider_type,
      model: provider.model,
      latencyMs,
      sample: result.sample.slice(0, 80),
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error(
      "[platform-ai-provider-test] provider request failed",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse({
      success: false,
      latencyMs,
      reason: timedOut ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_ERROR",
      userMessage: timedOut
        ? "O provedor excedeu o tempo máximo de resposta."
        : "Não foi possível concluir o teste do provedor.",
    });
  }
});
