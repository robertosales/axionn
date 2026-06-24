// deno-lint-ignore-file no-explicit-any
/**
 * count-function-points
 *
 * Conta Pontos de Função (APF/IFPUG) para uma User Story usando IA.
 *
 * Padrões seguidos:
 *   - Auth JWT obrigatória (ou service_role bypass para workers)
 *   - API key resolvida via Vault (get_ai_provider_key_by_id) — mesma lógica de apf-generate
 *   - Multi-provider com fallback automático (dinâmico via banco)
 *   - Few-shot learning: busca últimas contagens validadas do time e injeta no prompt
 *   - Resposta JSON estruturada: { EI, EO, EQ, ILF, EIF, total, confidence, reasoning }
 *   - Persiste resultado em user_stories + function_point_analyses
 *
 * CORREÇÃO 2026-06-24 (v4) — diagnóstico com testes locais 10/10:
 *   - buildFpPrompt: removida persona "Você é especialista..." do user message
 *     (conflitava com system message no Llama3 — modelo priorizava user e ignorava JSON)
 *   - callGenericWithSystemPrompt: system message reescrito com exemplo inline concreto
 *   - extractJsonFromText: estratégia 5 — sanitiza aspas duplas internas no reasoning
 *   - parseFpResponse regex fallback: aceita "EI = 2" e "EI (Entradas): 2" (regex avançado)
 *   - parseFpResponse: desembrulha JSON wrapper {"analysis": {...}} do Llama3
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Tipos ───────────────────────────────────────────────────
type RequestFormat = "openai_compatible" | "gemini" | "anthropic";
type Complexity = "baixa" | "media" | "alta";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  model: string | null;
  api_base_url: string | null;
  request_format: RequestFormat | null;
}

interface RequestBody {
  teamId: string;
  huId: string;
  storyText: string;
  context?: {
    storyPoints?: number | null;
    acceptanceCriteria?: string | null;
    storyType?: string | null;
  };
  providerId?: string;
  forceProvider?: "lovable";
}

interface FpBreakdown {
  EI: number;
  EO: number;
  EQ: number;
  ILF: number;
  EIF: number;
  total: number;
  complexity: Complexity;
  reasoning: string;
  confidence: number;
}

interface FewShotExample {
  storyText: string;
  validatedCount: number;
  breakdown: any;
}

// ─── Provider helpers ─────────────────────────────────────────
class ProviderError extends Error {
  status: number;
  providerName: string;
  constructor(name: string, status: number, msg: string) {
    super(`${name} [${status}]: ${msg}`);
    this.status = status;
    this.providerName = name;
  }
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  lovable: "google/gemini-2.5-flash",
  perplexity: "sonar",
  sakana: "fugu",
  groq: "llama-3.3-70b-versatile",
};

// Providers que NÃO suportam response_format:json_object — precisam de system message
const PROVIDERS_NO_JSON_MODE = ["groq", "perplexity", "sakana"];

async function resolveRecommendedProvider(teamId: string, explicitProviderId?: string): Promise<ProviderRow> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const select = "id, name, provider_type, model, api_base_url, request_format";

  let row: ProviderRow | null = null;

  if (explicitProviderId) {
    const { data } = await admin
      .from("ai_providers")
      .select(select)
      .eq("id", explicitProviderId)
      .eq("is_active", true)
      .maybeSingle();
    row = data as ProviderRow | null;
  }

  if (!row) {
    const { data } = await admin
      .from("ai_providers")
      .select(select)
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .order("name")
      .limit(1)
      .maybeSingle();
    row = data as ProviderRow | null;
  }

  if (!row) throw new Error("Nenhum provedor de IA ativo encontrado. Configure um provider no painel administrativo.");
  return row;
}

async function getKeyForRow(row: ProviderRow): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  let key = (data as string) ?? null;
  if (!key) {
    const envMap: Record<string, string> = {
      lovable: "LOVABLE_API_KEY",
      groq: "GROQ_API_KEY",
      sakana: "SAKANA_API_KEY",
    };
    const envVar = envMap[row.provider_type];
    if (envVar) key = Deno.env.get(envVar) ?? null;
  }
  return key;
}

async function listFallbackProviders(excludeId: string): Promise<ProviderRow[]> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, model, api_base_url, request_format")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("name");
  return ((data ?? []) as ProviderRow[]).filter((p) => p.id !== excludeId);
}

// ─── Chamadas de IA ───────────────────────────────────────────

/**
 * callGenericWithSystemPrompt
 * Para Groq/Perplexity/Sakana: envia system message explícito com exemplo inline.
 * IMPORTANTE: o user message NÃO deve repetir a persona "Você é especialista..."
 * pois isso conflita com o system message no Llama3, que então ignora o formato JSON.
 */
async function callGenericWithSystemPrompt(
  providerName: string,
  apiBaseUrl: string,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const r = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Você é um analisador de Pontos de Função IFPUG. " +
            "REGRA ABSOLUTA: responda APENAS com um objeto JSON válido, " +
            "sem nenhum texto antes ou depois, sem markdown, sem blocos de código. " +
            "Exemplo do único formato aceito: " +
            '{"EI":2,"EO":1,"EQ":0,"ILF":1,"EIF":0,"total":16,"confidence":0.85,"reasoning":"2 EI de cadastro, 1 EO relatorio, 1 ILF entidade"}',
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new ProviderError(providerName, r.status, await r.text());
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${providerName} retornou resposta inesperada: ${JSON.stringify(d).slice(0, 200)}`);
  return text;
}

async function callGeneric(
  providerName: string,
  apiBaseUrl: string,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const r = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new ProviderError(providerName, r.status, await r.text());
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${providerName} retornou resposta inesperada: ${JSON.stringify(d).slice(0, 200)}`);
  return text;
}

async function callOpenAIJsonMode(
  providerName: string,
  apiBaseUrl: string,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const r = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new ProviderError(providerName, r.status, await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  if (model.startsWith("google/")) model = model.replace("google/", "");
  const fullPrompt = prompt + "\n\nResposta SOMENTE em JSON válido, sem markdown ou blocos de código.";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      }),
    },
  );
  const d = await r.json();
  if (!r.ok || d.error) throw new ProviderError("Gemini", r.status || 500, d.error?.message ?? `HTTP ${r.status}`);
  const geminiText = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (geminiText && geminiText.trim().startsWith("```")) {
    console.warn("[count-fp] Gemini retornou markdown apesar de response_mime_type:application/json");
  }
  return geminiText;
}

async function callAnthropic(prompt: string, apiKey: string, model = "claude-3-5-haiku-20241022"): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new ProviderError("Anthropic", r.status, await r.text());
  const d = await r.json();
  return d.content?.[0]?.text ?? "";
}

async function callProvider(row: ProviderRow, prompt: string, apiKey: string): Promise<string> {
  const format = row.request_format ?? "openai_compatible";
  const model = row.model ?? DEFAULT_MODELS[row.provider_type] ?? "";

  if (format === "gemini") {
    return callGemini(prompt, apiKey, model || "gemini-2.0-flash");
  }

  if (format === "anthropic") {
    return callAnthropic(prompt, apiKey, model || "claude-3-5-haiku-20241022");
  }

  const baseUrl = row.api_base_url ?? "https://api.openai.com/v1/chat/completions";
  if (!model) throw new Error(`Provider "${row.name}" sem modelo configurado.`);

  // Groq, Perplexity e Sakana NÃO suportam response_format:json_object
  // Usam system message dedicado — prompt user NÃO deve repetir persona
  if (PROVIDERS_NO_JSON_MODE.includes(row.provider_type)) {
    return callGenericWithSystemPrompt(row.name, baseUrl, prompt, apiKey, model);
  }

  // OpenAI e Lovable suportam json_object nativo
  const supportsJsonMode = ["openai", "lovable"].includes(row.provider_type);
  if (supportsJsonMode) {
    return callOpenAIJsonMode(row.name, baseUrl, prompt, apiKey, model);
  }

  // Fallback genérico para qualquer outro provider
  return callGeneric(row.name, baseUrl, prompt, apiKey, model);
}

// ─── Few-shot ─────────────────────────────────────────────────
async function fetchFewShotExamples(teamId: string): Promise<FewShotExample[]> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const { data } = await admin
      .from("function_point_analyses")
      .select("story_text, validated_count, ai_breakdown")
      .eq("team_id", teamId)
      .eq("is_validated", true)
      .order("validated_at", { ascending: false })
      .limit(15);
    return (data ?? []).map((r: any) => ({
      storyText: r.story_text,
      validatedCount: r.validated_count,
      breakdown: r.ai_breakdown,
    }));
  } catch (_e) {
    return [];
  }
}

// ─── Prompt ───────────────────────────────────────────────────
function buildFpPrompt(storyText: string, context: RequestBody["context"], examples: FewShotExample[]): string {
  const examplesBlock =
    examples.length > 0
      ? `\n\n## Exemplos validados deste projeto (use como referência de calibração):\n` +
        examples
          .map(
            (ex, i) =>
              `Exemplo ${i + 1}:\nHU: ${ex.storyText.slice(0, 300)}\n` +
              `PF Validado: ${ex.validatedCount}\n` +
              (ex.breakdown
                ? `Breakdown: EI=${ex.breakdown.EI ?? 0} EO=${ex.breakdown.EO ?? 0} ` +
                  `EQ=${ex.breakdown.EQ ?? 0} ILF=${ex.breakdown.ILF ?? 0} EIF=${ex.breakdown.EIF ?? 0}`
                : ""),
          )
          .join("\n---\n")
      : "\n\n(Nenhum exemplo validado ainda para este projeto — use seu conhecimento IFPUG como base.)";

  const contextBlock = context
    ? [
        context.storyPoints != null ? `Story Points: ${context.storyPoints}` : "",
        context.storyType ? `Tipo: ${context.storyType}` : "",
        context.acceptanceCriteria ? `Critérios de Aceite:\n${context.acceptanceCriteria}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  // IMPORTANTE: NÃO iniciar com "Você é um especialista..." pois isso conflita
  // com o system message nos providers Groq/Perplexity/Sakana (Llama3 ignora o
  // formato JSON do system quando o user message redefine um papel diferente).
  return `Conte os Pontos de Função IFPUG da User Story abaixo.
${examplesBlock}

## Classificação IFPUG:
- **EI** (External Input): Processo elementar que processa dados ou informações que entram no sistema
- **EO** (External Output): Processo elementar que envia dados para fora do sistema (com lógica de transformação)
- **EQ** (External Inquiry): Processo elementar de consulta sem transformação significativa
- **ILF** (Internal Logical File): Grupo lógico de dados mantido pelo próprio sistema
- **EIF** (External Interface File): Grupo lógico de dados mantido por outro sistema

## Tabela de peso (complexidade simples):
| Tipo | PF |
|------|-----|
| EI   | 3  |
| EO   | 4  |
| EQ   | 3  |
| ILF  | 7  |
| EIF  | 5  |

## User Story para analisar:
${storyText}
${contextBlock ? "\n## Contexto adicional:\n" + contextBlock : ""}

## REGRA ABSOLUTA — FORMATO DA RESPOSTA:
Retorne APENAS o objeto JSON abaixo. Sem texto antes, sem texto depois,
sem markdown, sem blocos de código, sem explicações fora do JSON.
Se você incluir QUALQUER texto fora do JSON, sua resposta será rejeitada.

CORRETO (exatamente assim):
{"EI":2,"EO":1,"EQ":1,"ILF":1,"EIF":0,"total":17,"confidence":0.85,"reasoning":"Identificados: 2 EI de cadastro, 1 EO de relatorio, 1 EQ de consulta, 1 ILF principal"}

INCORRETO (não faça isso):
"Aqui está minha análise: {...}"
\`\`\`json {...} \`\`\`
"Com base na HU: EI=2..."

Responda AGORA com apenas o JSON:`;
}

// ─── Parser robusto JSON ──────────────────────────────────────
function calcComplexity(total: number): Complexity {
  if (total <= 10) return "baixa";
  if (total <= 25) return "media";
  return "alta";
}

function extractJsonFromText(text: string): string | null {
  // Estratégia 1: JSON puro
  try { JSON.parse(text); return text; } catch (_) { /* continua */ }

  // Estratégia 2: bloco ```json ... ``` ou ``` ... ```
  const codeBlock = text.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    const inner = codeBlock[1].trim();
    try { JSON.parse(inner); return inner; } catch (_) { /* continua */ }
  }

  // Estratégia 3: primeiro { ... } balanceado
  let depth = 0, start = -1, endPos = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        endPos = i;
        try { JSON.parse(candidate); return candidate; } catch (_) { /* continua */ }
        break; // saiu do primeiro objeto — guarda posição para estratégias seguintes
      }
    }
  }

  // Estratégia 4: remove trailing commas e tenta de novo
  if (start !== -1) {
    try {
      const raw = endPos !== -1 ? text.slice(start, endPos + 1) : text.slice(start);
      const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { JSON.parse(match[0]); return match[0]; }
    } catch (_) { /* continua */ }
  }

  // Estratégia 5: sanitiza aspas duplas internas no campo reasoning
  // O Llama3 frequentemente produz: "reasoning":"texto com "aspas" internas"}
  if (start !== -1) {
    try {
      const raw = endPos !== -1 ? text.slice(start, endPos + 1) : text.slice(start);
      // Substitui aspas duplas dentro de valores string por aspas simples
      const sanitized = raw
        .replace(/("reasoning"\s*:\s*")([\s\S]*?)("(?:\s*[,}]))/g, (_m, pre, inner, post) =>
          pre + inner.replace(/"/g, "'") + post
        )
        .replace(/,\s*([}\]])/g, "$1");
      const match = sanitized.match(/\{[\s\S]*\}/);
      if (match) { JSON.parse(match[0]); return match[0]; }
    } catch (_) { /* continua */ }
  }

  return null;
}

function parseFpResponse(raw: string): FpBreakdown {
  const text = raw.trim();
  const jsonStr = extractJsonFromText(text);

  if (!jsonStr) {
    // Última tentativa: extração por regex de campos individuais
    // Regex avançado: aceita "EI: 2", "EI = 2", "EI (Entradas Externas): 2"
    console.warn("[count-fp] JSON não encontrado, extraindo campos via regex:", text.slice(0, 300));
    const extract = (key: string) => {
      const m = new RegExp(`\\b${key}\\b[^0-9\\n]*?(\\d+)`, "i").exec(text);
      return m ? parseInt(m[1], 10) : 0;
    };
    const EI = extract("EI"), EO = extract("EO"), EQ = extract("EQ");
    const ILF = extract("ILF"), EIF = extract("EIF");
    const total = EI * 3 + EO * 4 + EQ * 3 + ILF * 7 + EIF * 5;
    const reasoningMatch = text.match(/"?reasoning"?\s*[=:]\s*"?([^"\n]+)"?/i);
    const confidenceMatch = text.match(/"?confidence"?\s*[=:]\s*([\d.]+)/i);
    return {
      EI, EO, EQ, ILF, EIF,
      total: total || extract("total"),
      complexity: calcComplexity(total),
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
      reasoning: reasoningMatch?.[1]?.slice(0, 500) ?? "Extraído de resposta não-JSON",
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (_e) {
    try {
      parsed = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1"));
    } catch (_e2) {
      throw new Error(`A IA não retornou JSON válido após todas as tentativas. Tente novamente.`);
    }
  }

  // Desembrulha wrapper {"analysis": {...}} que o Llama3 às vezes produz
  if (!("EI" in parsed)) {
    for (const val of Object.values(parsed)) {
      if (val && typeof val === "object" && "EI" in (val as any)) {
        parsed = val;
        break;
      }
    }
  }

  const EI  = Math.max(0, parseInt(parsed.EI  ?? 0, 10));
  const EO  = Math.max(0, parseInt(parsed.EO  ?? 0, 10));
  const EQ  = Math.max(0, parseInt(parsed.EQ  ?? 0, 10));
  const ILF = Math.max(0, parseInt(parsed.ILF ?? 0, 10));
  const EIF = Math.max(0, parseInt(parsed.EIF ?? 0, 10));
  const total = EI * 3 + EO * 4 + EQ * 3 + ILF * 7 + EIF * 5;
  const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence ?? 0.7)));
  const reasoning = String(parsed.reasoning ?? "").slice(0, 1000);

  return { EI, EO, EQ, ILF, EIF, total, complexity: calcComplexity(total), confidence, reasoning };
}

// ─── Persiste resultado ───────────────────────────────────────
async function persistResult(opts: {
  teamId: string;
  huId: string;
  storyText: string;
  breakdown: FpBreakdown;
  modelUsed: string;
  fewShotCount: number;
}): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { teamId, huId, storyText, breakdown, modelUsed, fewShotCount } = opts;

  try {
    await admin
      .from("user_stories")
      .update({
        function_points: breakdown.total,
        ai_fp_breakdown: breakdown,
        ai_fp_confidence: breakdown.confidence,
      } as any)
      .eq("id", huId);
  } catch (_e) {
    console.warn("[count-fp] user_stories update failed:", _e);
  }

  try {
    const { data } = await admin.from("function_point_analyses" as any).upsert(
      {
        team_id: teamId,
        story_id: huId,
        story_text: storyText.slice(0, 2000),
        ai_raw_count: breakdown.total,
        ai_breakdown: breakdown,
        ai_confidence: breakdown.confidence,
        ai_reasoning: breakdown.reasoning,
        model_used: modelUsed,
        few_shot_examples_used: fewShotCount,
        is_validated: false,
      },
      { onConflict: "story_id", ignoreDuplicates: false },
    ).select("id").maybeSingle();
    return (data as any)?.id ?? null;
  } catch (_e) {
    console.warn("[count-fp] function_point_analyses insert failed:", _e);
    return null;
  }
}

// ─── Handler principal ────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const isServiceRole = SERVICE_KEY && token === SERVICE_KEY;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { teamId, huId, storyText, context, providerId, forceProvider } = body;

    if (!teamId || !UUID_REGEX.test(teamId))
      return new Response(JSON.stringify({ error: "teamId (UUID) é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (!huId || !UUID_REGEX.test(huId))
      return new Response(JSON.stringify({ error: "huId (UUID) é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (!storyText?.trim())
      return new Response(JSON.stringify({ error: "storyText é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Guard: HU muito curta não tem conteúdo suficiente para análise IFPUG
    if (storyText.trim().length < 50) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "O texto da User Story está muito curto para análise de Pontos de Função. Preencha a HU com mais detalhes antes de calcular.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let providerRow: ProviderRow;
    let apiKey: string | null;

    if (forceProvider === "lovable") {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? null;
      if (!lovableKey) {
        return new Response(
          JSON.stringify({ error: "Lovable AI não está disponível (LOVABLE_API_KEY ausente)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      providerRow = {
        id: "__lovable__",
        name: "Lovable AI (grátis)",
        provider_type: "lovable",
        model: "google/gemini-2.5-flash",
        api_base_url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        request_format: "openai_compatible",
      };
      apiKey = lovableKey;
    } else {
      providerRow = await resolveRecommendedProvider(teamId, providerId);
      apiKey = await getKeyForRow(providerRow);
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key não configurada para "${providerRow.name}". Configure no painel administrativo.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const examples = await fetchFewShotExamples(teamId);
    const prompt = buildFpPrompt(storyText, context, examples);

    let rawResponse = "";
    let usedProviderName = providerRow.name;
    let usedModel = providerRow.model ?? providerRow.provider_type;

    try {
      rawResponse = await callProvider(providerRow, prompt, apiKey);
    } catch (primaryErr: any) {
      const primaryStatus = primaryErr instanceof ProviderError ? primaryErr.status : 500;
      console.warn(`[count-fp] Provider "${providerRow.name}" falhou (${primaryStatus}). Tentando fallback...`);

      const candidates = await listFallbackProviders(providerRow.id);
      let succeeded = false;

      for (const cand of candidates) {
        const candKey = await getKeyForRow(cand);
        if (!candKey) continue;
        try {
          rawResponse = await callProvider(cand, prompt, candKey);
          usedProviderName = cand.name;
          usedModel = cand.model ?? cand.provider_type;
          succeeded = true;
          console.log(`[count-fp] Fallback ok: ${providerRow.name} → ${cand.name}`);
          break;
        } catch (_fe: any) {
          console.warn(`[count-fp] Fallback "${cand.name}" também falhou.`);
        }
      }

      if (!succeeded) throw primaryErr;
    }

    if (!rawResponse.trim()) throw new Error("IA retornou conteúdo vazio");

    console.log(`[count-fp] Raw response (${usedProviderName}, ${rawResponse.length} chars):`, rawResponse.slice(0, 500));
    const breakdown = parseFpResponse(rawResponse);

    // Guard: se todos os elementos são zero mas a HU tem conteúdo, a IA falhou silenciosamente
    if (breakdown.total === 0 && storyText.trim().length > 100) {
      console.error(
        `[count-fp] total=0 com HU preenchida. Provider: ${usedProviderName}. ` +
        `Raw (500 chars): ${rawResponse.slice(0, 500)}`
      );
      throw new Error(
        `A IA (${usedProviderName}) não identificou elementos funcionais na HU. ` +
        `Verifique se a HU está descrita corretamente e tente novamente.`
      );
    }

    const analysisId = await persistResult({
      teamId, huId, storyText, breakdown,
      modelUsed: usedModel,
      fewShotCount: examples.length,
    });

    // Resposta alinhada com FPCountResponse do frontend
    return new Response(
      JSON.stringify({
        success: true,
        analysis_id:            analysisId,
        ai_raw_count:           breakdown.total,
        ai_breakdown:           breakdown,
        ai_confidence:          breakdown.confidence,
        ai_reasoning:           breakdown.reasoning,
        few_shot_examples_used: examples.length,
        model_used:             usedModel,
        providerUsed:           usedProviderName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    console.error("[count-function-points] erro:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    let friendly = msg;
    if (/credit balance|insufficient_quota/i.test(msg))
      friendly = "O provedor de IA está sem créditos. Configure outro provider no painel.";
    else if (/invalid.*api.key|incorrect api key/i.test(msg))
      friendly = "Chave de API inválida. Verifique no painel administrativo.";
    else if (/rate limit|429/i.test(msg))
      friendly = "Limite de requisições atingido. Aguarde alguns segundos.";

    return new Response(JSON.stringify({ success: false, error: friendly, rawError: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
