// deno-lint-ignore-file no-explicit-any
/**
 * count-function-points
 *
 * Conta Pontos de Função (APF/IFPUG) para uma User Story usando IA.
 *
 * Padrões seguidos:
 *   - Auth JWT obrigatória (ou service_role bypass para workers)
 *   - API key resolvida via Vault (get_ai_provider_key_by_id) — mesma lógica de apf-generate
 *   - Multi-provider com fallback automático: lovable → openai → gemini → anthropic
 *   - Few-shot learning: busca últimas contagens validadas do time e injeta no prompt
 *   - Resposta JSON estruturada: { EI, EO, EQ, ILF, EIF, total, confidence, reasoning }
 *   - Persiste resultado em user_stories + function_point_analyses
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

type Provider = "openai" | "anthropic" | "gemini" | "lovable" | "perplexity" | "sakana.ai";

// ─── Tipos ───────────────────────────────────────────────────
interface RequestBody {
  teamId: string;
  huId: string;
  storyText: string;
  context?: {
    storyPoints?: number | null;
    acceptanceCriteria?: string | null;
    storyType?: string | null;
  };
  // Provedor: se omitido usa o provider recomendado do time / primeiro ativo
  providerId?: string;
  // Força Lovable AI Gateway (grátis) ignorando ai_providers
  forceProvider?: "lovable";
}

interface FpBreakdown {
  EI: number; // External Input
  EO: number; // External Output
  EQ: number; // External Inquiry
  ILF: number; // Internal Logical File
  EIF: number; // External Interface File
  total: number;
  reasoning: string;
}

interface FewShotExample {
  storyText: string;
  validatedCount: number;
  breakdown: any;
}

// ─── Provider helpers (mesma lógica de apf-generate) ─────────
class ProviderError extends Error {
  status: number;
  providerName: string;
  constructor(name: string, status: number, msg: string) {
    super(`${name} [${status}]: ${msg}`);
    this.status = status;
    this.providerName = name;
  }
}

async function resolveRecommendedProvider(teamId: string, explicitProviderId?: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let row: any = null;

  if (explicitProviderId) {
    const { data } = await admin
      .from("ai_providers")
      .select("id, name, provider_type, model, is_active")
      .eq("id", explicitProviderId)
      .eq("is_active", true)
      .maybeSingle();
    row = data;
  }

  if (!row) {
    // Usa o provider recomendado e ativo do time
    const { data } = await admin
      .from("ai_providers")
      .select("id, name, provider_type, model")
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .order("name")
      .limit(1)
      .maybeSingle();
    row = data;
  }

  if (!row) throw new Error("Nenhum provedor de IA ativo encontrado. Configure um provider no painel administrativo.");

  return row as { id: string; name: string; provider_type: Provider; model: string | null };
}

async function getKeyForRow(row: { id: string; provider_type: Provider }): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  let key = (data as string) ?? null;
  if (!key && row.provider_type === "lovable") key = Deno.env.get("LOVABLE_API_KEY") ?? null;
  return key;
}

async function listFallbackProviders(excludeId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, model")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("name");
  return ((data ?? []) as any[]).filter((p) => p.id !== excludeId);
}

async function callLovable(prompt: string, apiKey: string, model = "google/gemini-2.5-flash"): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new ProviderError("Lovable AI", r.status, await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function callOpenAI(prompt: string, apiKey: string, model = "gpt-4o"): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new ProviderError("OpenAI", r.status, await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  if (model.startsWith("google/")) model = model.replace("google/", "");
  // Instrui o Gemini a retornar JSON
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
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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

async function callProvider(type: Provider, prompt: string, apiKey: string, model?: string | null): Promise<string> {
  switch (type) {
    case "lovable":
      return callLovable(prompt, apiKey, model ?? undefined);
    case "openai":
      return callOpenAI(prompt, apiKey, model ?? undefined);
    case "gemini":
      return callGemini(prompt, apiKey, model ?? undefined);
    case "anthropic":
      return callAnthropic(prompt, apiKey, model ?? undefined);
    case "perplexity":
      return callOpenAI(prompt, apiKey, model ?? "sonar"); // Perplexity é compatível OpenAI
    default:
      return callOpenAI(prompt, apiKey, model ?? undefined);
  }
}

// ─── Few-shot: busca exemplos validados do time ───────────────
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
    // Tabela ainda não existe — retorna vazio, sem quebrar
    return [];
  }
}

// ─── Monta prompt com few-shot ────────────────────────────────
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

  return `Você é um especialista certificado em Análise de Pontos de Função (APF) segundo a metodologia IFPUG.
Sua tarefa é contar os Pontos de Função Brutos de uma única User Story.
${examplesBlock}

## Classificação IFPUG:
- **EI** (External Input): Processo elementar que processa dados ou informações que entram no sistema
- **EO** (External Output): Processo elementar que envia dados para fora do sistema (com lógica de transformação)
- **EQ** (External Inquiry): Processo elementar de consulta sem transformação significativa
- **ILF** (Internal Logical File): Grupo lógico de dados mantido pelo próprio sistema
- **EIF** (External Interface File): Grupo lógico de dados mantido por outro sistema

## Tabela de peso (complexidade simples):
| Tipo | PF |
|------|----|\n| EI   | 3  |
| EO   | 4  |
| EQ   | 3  |
| ILF  | 7  |
| EIF  | 5  |

## User Story para analisar:
${storyText}
${contextBlock ? "\n## Contexto adicional:\n" + contextBlock : ""}

## Resposta obrigatória — JSON puro sem markdown:
{
  "EI": <número>,
  "EO": <número>,
  "EQ": <número>,
  "ILF": <número>,
  "EIF": <número>,
  "total": <soma dos pesos acima>,
  "confidence": <0.0 a 1.0, quanta certeza você tem>,
  "reasoning": "<explicação concisa em português do que foi identificado>"
}`;
}

// ─── Parseia resposta da IA → FpBreakdown ────────────────────
function parseFpResponse(raw: string): FpBreakdown {
  let text = raw.trim();
  // Remove blocos de código caso o provider ignore o response_format
  text = text
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (_e) {
    // Extrai JSON da resposta se vier com texto ao redor
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`IA não retornou JSON válido: ${text.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  const EI = Math.max(0, parseInt(parsed.EI ?? 0, 10));
  const EO = Math.max(0, parseInt(parsed.EO ?? 0, 10));
  const EQ = Math.max(0, parseInt(parsed.EQ ?? 0, 10));
  const ILF = Math.max(0, parseInt(parsed.ILF ?? 0, 10));
  const EIF = Math.max(0, parseInt(parsed.EIF ?? 0, 10));

  // Calcula PF bruto com pesos IFPUG (complexidade simples)
  const total = EI * 3 + EO * 4 + EQ * 3 + ILF * 7 + EIF * 5;

  const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence ?? 0.7)));
  const reasoning = String(parsed.reasoning ?? "").slice(0, 1000);

  return { EI, EO, EQ, ILF, EIF, total, confidence, reasoning };
}

// ─── Persiste resultado no banco ─────────────────────────────
async function persistResult(opts: {
  teamId: string;
  huId: string;
  storyText: string;
  breakdown: FpBreakdown;
  modelUsed: string;
  fewShotCount: number;
}) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { teamId, huId, storyText, breakdown, modelUsed, fewShotCount } = opts;

  // 1. Atualiza user_stories (colunas podem não existir ainda — silent fail)
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
    console.warn("[count-fp] user_stories update failed (colunas ai_fp_* talvez não existam ainda):", _e);
  }

  // 2. Registra em function_point_analyses (tabela de aprendizado)
  try {
    await admin.from("function_point_analyses" as any).upsert(
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
    );
  } catch (_e) {
    // Tabela ainda não criada — não quebra o fluxo
    console.warn("[count-fp] function_point_analyses insert failed (migration pendente?):", _e);
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
    // ── 1. Auth ───────────────────────────────────────────────
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
      const {
        data: { user },
        error: authErr,
      } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 2. Parse body ─────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { teamId, huId, storyText, context, providerId, forceProvider } = body;

    if (!teamId || !UUID_REGEX.test(teamId))
      return new Response(JSON.stringify({ error: "teamId (UUID) é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (!huId || !UUID_REGEX.test(huId))
      return new Response(JSON.stringify({ error: "huId (UUID) é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (!storyText?.trim())
      return new Response(JSON.stringify({ error: "storyText é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── 3. Resolve provider + API key ─────────────────────────
    let providerRow: { id: string; name: string; provider_type: Provider; model: string | null };
    let apiKey: string | null;

    if (forceProvider === "lovable") {
      // Atalho: Lovable AI Gateway (grátis) — usa LOVABLE_API_KEY do ambiente
      const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? null;
      if (!lovableKey) {
        return new Response(
          JSON.stringify({ error: "Lovable AI não está disponível neste workspace (LOVABLE_API_KEY ausente)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      providerRow = {
        id: "__lovable__",
        name: "Lovable AI (grátis)",
        provider_type: "lovable",
        model: "google/gemini-2.5-flash",
      };
      apiKey = lovableKey;
    } else {
      providerRow = await resolveRecommendedProvider(teamId, providerId);
      apiKey = await getKeyForRow(providerRow);
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `API key não configurada para "${providerRow.name}". Configure no painel administrativo.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Busca exemplos validados (few-shot) ────────────────
    const examples = await fetchFewShotExamples(teamId);

    // ── 5. Monta prompt e chama IA (com fallback) ─────────────
    const prompt = buildFpPrompt(storyText, context, examples);
    let rawResponse = "";
    let usedProviderName = providerRow.name;
    let usedModel = providerRow.model ?? providerRow.provider_type;

    try {
      rawResponse = await callProvider(providerRow.provider_type, prompt, apiKey, providerRow.model);
    } catch (primaryErr: any) {
      const primaryStatus = primaryErr instanceof ProviderError ? primaryErr.status : 500;
      console.warn(`[count-fp] Provider "${providerRow.name}" falhou (${primaryStatus}). Tentando fallback...`);

      const candidates = await listFallbackProviders(providerRow.id);
      let succeeded = false;

      for (const cand of candidates) {
        const candKey = await getKeyForRow(cand);
        if (!candKey) continue;
        try {
          rawResponse = await callProvider(cand.provider_type, prompt, candKey, cand.model);
          usedProviderName = cand.name;
          usedModel = cand.model ?? cand.provider_type;
          succeeded = true;
          console.log(`[count-fp] Fallback ok: ${providerRow.name} → ${cand.name}`);
          break;
        } catch (_fe: any) {
          console.warn(`[count-fp] Fallback "${cand.name}" também falhou.`);
        }
      }

      if (!succeeded) {
        throw primaryErr;
      }
    }

    if (!rawResponse.trim()) throw new Error("IA retornou conteúdo vazio");

    // ── 6. Parseia resposta ───────────────────────────────────
    const breakdown = parseFpResponse(rawResponse);

    // ── 7. Persiste resultado ─────────────────────────────────
    await persistResult({
      teamId,
      huId,
      storyText,
      breakdown,
      modelUsed: usedModel,
      fewShotCount: examples.length,
    });

    // ── 8. Retorna ────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        breakdown,
        total: breakdown.total,
        confidence: breakdown.confidence,
        reasoning: breakdown.reasoning,
        providerUsed: usedProviderName,
        fewShotExamples: examples.length,
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
    else if (/rate limit|429/i.test(msg)) friendly = "Limite de requisições atingido. Aguarde alguns segundos.";

    return new Response(JSON.stringify({ success: false, error: friendly, rawError: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
