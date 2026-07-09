import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PROVIDER_TIMEOUT_MS = Number(
  Deno.env.get("AI_BRIEFING_TIMEOUT_MS") ?? 60_000,
);

const PROMPT_VERSION = "briefing.v1";
const SCHEMA_VERSION = "briefing.suggestions.v1";

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
  is_recommended: boolean;
  created_at?: string;
}

type SuggestionType = "task" | "decision" | "risk" | "follow_up";
const ALLOWED_TYPES: SuggestionType[] = ["task", "decision", "risk", "follow_up"];
const ALLOWED_PRIORITY = ["low", "medium", "high"] as const;
const ALLOWED_DATE_SOURCE = ["explicit", "inferred", "none"] as const;

interface RawSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | null;
  assignee_name: string | null;
  due_date: string | null;
  date_source: "explicit" | "inferred" | "none";
}

interface ParsedOutput {
  summary: string;
  suggestions: RawSuggestion[];
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

function buildSystemPrompt(language: string) {
  const lang = (language || "pt-BR").toLowerCase().startsWith("pt")
    ? "pt-BR"
    : language;
  return [
    `Você é um assistente sênior de gestão ágil. Você recebe uma ata/transcrição de reunião do módulo Sala Ágil e deve extrair itens acionáveis para o time.`,
    `Idioma da resposta: ${lang}. Evite jargão desnecessário.`,
    `Regras de negócio obrigatórias:`,
    `- Toda tarefa (task) descreve algo que pode virar HU/atividade; estimativa implícita máxima de 24h por tarefa e 8h por atividade individual.`,
    `- due_date, quando presente, deve ser ISO yyyy-mm-dd e nunca anterior à meeting_date informada.`,
    `- Não invente participantes; use apenas nomes citados na transcrição ou deixe assignee_name como null.`,
    `- Se não houver informação suficiente para um campo opcional, use null.`,
    `- Classifique cada item em: "task" (ação executável), "decision" (decisão tomada), "risk" (risco/impedimento) ou "follow_up" (assunto a acompanhar).`,
    `Formato de saída: RESPONDA EXCLUSIVAMENTE COM UM ÚNICO OBJETO JSON VÁLIDO, sem markdown, sem comentários, sem texto antes ou depois.`,
    `Estrutura obrigatória:`,
    `{`,
    `  "summary": string,`,
    `  "suggestions": [`,
    `    {`,
    `      "type": "task"|"decision"|"risk"|"follow_up",`,
    `      "title": string (<=120),`,
    `      "description": string (<=1200),`,
    `      "priority": "low"|"medium"|"high"|null,`,
    `      "assignee_name": string|null,`,
    `      "due_date": "yyyy-mm-dd"|null,`,
    `      "date_source": "explicit"|"inferred"|"none"`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(briefing: {
  title: string;
  briefing_type: string;
  meeting_date: string | null;
  participants: unknown;
  source_content: string;
}) {
  const participants = Array.isArray(briefing.participants)
    ? briefing.participants
    : briefing.participants ?? [];
  return [
    `Título: ${briefing.title}`,
    `Tipo: ${briefing.briefing_type}`,
    `Data da reunião: ${briefing.meeting_date ?? "não informada"}`,
    `Participantes: ${JSON.stringify(participants)}`,
    ``,
    `Conteúdo bruto:`,
    `"""`,
    briefing.source_content,
    `"""`,
    ``,
    `Retorne agora somente o JSON conforme o schema.`,
  ].join("\n");
}

async function callProvider(
  provider: ProviderRow,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {
  const format = provider.request_format ?? "openai_compatible";
  const model = provider.model ?? "";

  if (format === "gemini") {
    const resolvedModel = (model || "gemini-2.0-flash").replace(/^google\//, "");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: timeoutSignal(),
      },
    );
    if (!response.ok) return { ok: false as const, status: response.status };
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text
      ? { ok: true as const, text: String(text), usage: data?.usageMetadata ?? null }
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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: timeoutSignal(),
    });
    if (!response.ok) return { ok: false as const, status: response.status };
    const data = await response.json();
    const text = data?.content?.[0]?.text;
    return text
      ? { ok: true as const, text: String(text), usage: data?.usage ?? null }
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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
    signal: timeoutSignal(),
  });
  if (!response.ok) return { ok: false as const, status: response.status };
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  return text
    ? { ok: true as const, text: String(text), usage: data?.usage ?? null }
    : { ok: false as const, status: 502 };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1));
    }
    throw new Error("output is not valid JSON");
  }
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function validateOutput(
  raw: unknown,
  meetingDate: string | null,
): ParsedOutput {
  if (!raw || typeof raw !== "object") throw new Error("root must be object");
  const r = raw as Record<string, unknown>;
  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
  const suggestionsIn = Array.isArray(r.suggestions) ? r.suggestions : [];
  const suggestions: RawSuggestion[] = [];

  for (const s of suggestionsIn) {
    if (!s || typeof s !== "object") continue;
    const item = s as Record<string, unknown>;
    const type = String(item.type ?? "").toLowerCase() as SuggestionType;
    if (!ALLOWED_TYPES.includes(type)) continue;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const description = typeof item.description === "string"
      ? item.description.trim().slice(0, 1200)
      : "";
    const priorityRaw = toStringOrNull(item.priority)?.toLowerCase() ?? null;
    const priority = priorityRaw && (ALLOWED_PRIORITY as readonly string[]).includes(priorityRaw)
      ? (priorityRaw as RawSuggestion["priority"])
      : null;
    const assignee_name = toStringOrNull(item.assignee_name);
    let due_date = toStringOrNull(item.due_date);
    if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) due_date = null;
    if (due_date && meetingDate && due_date < meetingDate) due_date = null;
    const dsRaw = toStringOrNull(item.date_source)?.toLowerCase() ?? "none";
    const date_source = (ALLOWED_DATE_SOURCE as readonly string[]).includes(dsRaw)
      ? (dsRaw as RawSuggestion["date_source"])
      : "none";
    suggestions.push({
      type,
      title,
      description,
      priority,
      assignee_name,
      due_date,
      date_source,
    });
  }

  if (!suggestions.length) throw new Error("no valid suggestions");
  return { summary, suggestions };
}

async function selectProvider(
  admin: ReturnType<typeof createClient>,
  providerId: string | null,
): Promise<ProviderRow | null> {
  if (providerId) {
    const { data, error } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model,api_base_url,request_format,is_active,is_recommended")
      .eq("id", providerId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return (data as ProviderRow | null) ?? null;
  }
  const recommended = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active,is_recommended,created_at")
    .eq("is_active", true)
    .eq("is_recommended", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recommended.error) throw recommended.error;
  if (recommended.data) return recommended.data as ProviderRow;
  const any = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active,is_recommended,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (any.error) throw any.error;
  return (any.data as ProviderRow | null) ?? null;
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
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return jsonResponse({ error: "Token inválido" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const briefingId = typeof body?.briefingId === "string" ? body.briefingId : "";
  const providerIdInput = typeof body?.providerId === "string" ? body.providerId : "";
  if (!UUID_REGEX.test(briefingId)) {
    return jsonResponse({ error: "briefingId inválido" }, 400);
  }
  if (providerIdInput && !UUID_REGEX.test(providerIdInput)) {
    return jsonResponse({ error: "providerId inválido" }, 400);
  }

  // Carrega briefing com o client do usuário (respeita RLS)
  const { data: briefingRow, error: briefingError } = await userClient
    .from("ai_briefings")
    .select("id,org_id,briefing_type,language,source_content,participants,meeting_date,title")
    .eq("id", briefingId)
    .maybeSingle();
  if (briefingError) {
    console.error("[process-ai-briefing] briefing load failed", briefingError.message);
    return jsonResponse({ error: "Não foi possível carregar o briefing" }, 503);
  }
  if (!briefingRow) {
    return jsonResponse({ error: "Briefing não encontrado" }, 404);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Seleciona provedor ativo/recomendado
  let provider: ProviderRow | null;
  try {
    provider = await selectProvider(admin, providerIdInput || null);
  } catch (e) {
    console.error("[process-ai-briefing] provider lookup failed", e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: "Não foi possível carregar o provedor" }, 503);
  }
  if (!provider) {
    return jsonResponse({
      success: false,
      reason: "AI_PROVIDER_NOT_CONFIGURED",
      userMessage: "Nenhum provedor de IA ativo está configurado.",
    });
  }

  // Credencial via RPC
  const { data: keyData, error: keyError } = await admin.rpc(
    "get_ai_provider_key_by_id",
    { p_id: provider.id },
  );
  if (keyError) {
    console.error("[process-ai-briefing] key lookup failed", keyError.message);
    return jsonResponse({ error: "Não foi possível acessar a chave configurada" }, 503);
  }
  const apiKey = typeof keyData === "string" ? keyData.trim() : "";
  if (apiKey.length < 10) {
    return jsonResponse({
      success: false,
      reason: "AI_PROVIDER_KEY_MISSING",
      userMessage: "O provedor selecionado não possui uma chave válida configurada.",
    });
  }

  // Inicia run
  const requestId = crypto.randomUUID();
  const { data: runRows, error: startError } = await admin.rpc(
    "start_ai_briefing_run",
    {
      p_briefing_id: briefingId,
      p_prompt_version: PROMPT_VERSION,
      p_request_id: requestId,
      p_schema_version: SCHEMA_VERSION,
    },
  );
  const runRow = Array.isArray(runRows) ? runRows[0] : null;
  if (startError || !runRow?.run_id) {
    console.error("[process-ai-briefing] start_ai_briefing_run failed", startError?.message);
    return jsonResponse({ error: "Não foi possível iniciar o processamento" }, 503);
  }
  const runId: string = runRow.run_id;

  const systemPrompt = buildSystemPrompt(briefingRow.language ?? "pt-BR");
  const userPrompt = buildUserPrompt({
    title: runRow.title ?? briefingRow.title,
    briefing_type: runRow.briefing_type ?? briefingRow.briefing_type,
    meeting_date: runRow.meeting_date ?? briefingRow.meeting_date,
    participants: runRow.participants ?? briefingRow.participants,
    source_content: runRow.source_content ?? briefingRow.source_content,
  });

  const startedAt = Date.now();
  try {
    const result = await callProvider(provider, apiKey, systemPrompt, userPrompt);
    const latencyMs = Date.now() - startedAt;

    if (!result.ok) {
      const failure = sanitizeProviderFailure(result.status);
      await admin.rpc("fail_ai_briefing_run", {
        p_run_id: runId,
        p_error_code: failure.reason,
        p_error_detail: `HTTP ${result.status}`,
        p_duration_ms: latencyMs,
        p_model_name: provider.model ?? undefined,
        p_provider_id: provider.id,
      });
      return jsonResponse({ success: false, runId, latencyMs, ...failure });
    }

    let parsed: ParsedOutput;
    let rawJson: unknown;
    try {
      rawJson = extractJson(result.text);
      parsed = validateOutput(rawJson, briefingRow.meeting_date ?? null);
    } catch (e) {
      console.error("[process-ai-briefing] invalid model output", e instanceof Error ? e.message : String(e));
      await admin.rpc("fail_ai_briefing_run", {
        p_run_id: runId,
        p_error_code: "AI_OUTPUT_INVALID",
        p_error_detail: String(result.text).slice(0, 500),
        p_duration_ms: latencyMs,
        p_model_name: provider.model ?? undefined,
        p_provider_id: provider.id,
      });
      return jsonResponse({
        success: false,
        runId,
        latencyMs,
        reason: "AI_OUTPUT_INVALID",
        userMessage: "A IA respondeu em um formato inesperado. Tente novamente.",
      });
    }

    // Persiste sugestões
    const rows = parsed.suggestions.map((s, idx) => ({
      briefing_id: briefingId,
      run_id: runId,
      ordinal: idx + 1,
      suggestion_type: s.type,
      title: s.title,
      description: s.description,
      priority_hint: s.priority,
      suggested_assignee_name: s.assignee_name,
      suggested_due_date: s.due_date,
      date_source: s.date_source,
      original_payload: s as unknown as Record<string, unknown>,
      review_status: "pending",
    }));

    if (rows.length) {
      const { error: insertError } = await admin
        .from("ai_briefing_suggestions")
        .insert(rows);
      if (insertError) {
        console.error("[process-ai-briefing] suggestions insert failed", insertError.message);
        await admin.rpc("fail_ai_briefing_run", {
          p_run_id: runId,
          p_error_code: "SUGGESTIONS_PERSIST_FAILED",
          p_error_detail: insertError.message,
          p_duration_ms: latencyMs,
          p_model_name: provider.model ?? undefined,
          p_provider_id: provider.id,
        });
        return jsonResponse({
          success: false,
          runId,
          latencyMs,
          reason: "SUGGESTIONS_PERSIST_FAILED",
          userMessage: "Não foi possível salvar as sugestões geradas.",
        });
      }
    }

    const usage = (result as { usage?: Record<string, unknown> | null }).usage ?? null;
    const inputTokens = usage
      ? Number(
          (usage as Record<string, unknown>).prompt_tokens ??
            (usage as Record<string, unknown>).input_tokens ??
            (usage as Record<string, unknown>).promptTokenCount ??
            0,
        ) || undefined
      : undefined;
    const outputTokens = usage
      ? Number(
          (usage as Record<string, unknown>).completion_tokens ??
            (usage as Record<string, unknown>).output_tokens ??
            (usage as Record<string, unknown>).candidatesTokenCount ??
            0,
        ) || undefined
      : undefined;

    const { error: completeError } = await admin.rpc("complete_ai_briefing_run", {
      p_run_id: runId,
      p_provider_id: provider.id,
      p_model_name: provider.model ?? provider.provider_type,
      p_output_payload: rawJson as never,
      p_duration_ms: latencyMs,
      ...(inputTokens ? { p_input_tokens: inputTokens } : {}),
      ...(outputTokens ? { p_output_tokens: outputTokens } : {}),
    });
    if (completeError) {
      console.error("[process-ai-briefing] complete run failed", completeError.message);
    }

    return jsonResponse({
      success: true,
      runId,
      providerUsed: provider.name,
      providerType: provider.provider_type,
      model: provider.model,
      latencyMs,
      suggestionsCount: rows.length,
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error(
      "[process-ai-briefing] provider request failed",
      error instanceof Error ? error.message : String(error),
    );
    await admin.rpc("fail_ai_briefing_run", {
      p_run_id: runId,
      p_error_code: timedOut ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_ERROR",
      p_error_detail: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      p_duration_ms: latencyMs,
      p_model_name: provider.model ?? undefined,
      p_provider_id: provider.id,
    });
    return jsonResponse({
      success: false,
      runId,
      latencyMs,
      reason: timedOut ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_ERROR",
      userMessage: timedOut
        ? "O provedor excedeu o tempo máximo de resposta."
        : "Não foi possível concluir a geração do briefing.",
    });
  }
});