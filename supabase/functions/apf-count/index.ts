// deno-lint-ignore-file no-explicit-any
/**
 * apf-count — Edge Function
 *
 * Fluxo completo de contagem APF em um único endpoint:
 *   1. open_counting_session()  — cria sessão no banco
 *   2. build_apf_prompt()       — monta prompt dinâmico com regras do modelo
 *   3. Chama a IA               — retorna JSON estruturado com os EFs
 *   4. save_counting_items()    — persiste itens, gray_zones e totais
 *   5. Retorna resumo ao frontend
 *
 * Body esperado:
 *   {
 *     project_id:   string (UUID, obrigatório)
 *     sprint_ref:   string (ex: "Sprint 01")
 *     release_ref:  string (ex: "Release 05")
 *     redmine_ref:  string (ex: "25044")
 *     baseline_id:  string (UUID, opcional)
 *     providerId:   string (UUID, opcional — usa openai/gpt-4o se omitido)
 *     model:        string (opcional — override do modelo do provider)
 *     hu_texts:     string (opcional — texto bruto das HUs para injetar no prompt)
 *   }
 *
 * Resposta de sucesso:
 *   {
 *     success: true,
 *     session_id, inserted_items, inserted_gz,
 *     total_pf_bruto, total_pf_fs, total_functions, total_hus,
 *     provider_used, model_used
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL      = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Provider = "openai" | "anthropic" | "gemini" | "lovable" | "perplexity";

// ─────────────────────────────────────────────────────────────
// Resolução de provider (mesma lógica do apf-generate)
// ─────────────────────────────────────────────────────────────
async function resolveProvider(providerId?: string): Promise<{
  providerType: Provider;
  apiKey: string;
  model: string;
  name: string;
}> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Se não passou providerId, usa o primeiro openai ativo como padrão
  let row: { id: string; name: string; provider_type: Provider; model: string | null } | null = null;

  if (providerId) {
    const { data, error } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model,is_active")
      .eq("id", providerId)
      .maybeSingle();
    if (error || !data) throw new Error("Provedor de IA não encontrado.");
    if (!(data as any).is_active) throw new Error("Este provedor de IA está desativado.");
    row = data as any;
  } else {
    // Padrão: openai recomendado — melhor para JSON estruturado
    const { data } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model")
      .eq("provider_type", "openai")
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as any) ?? null;

    // Fallback: qualquer provider ativo
    if (!row) {
      const { data: any_ } = await admin
        .from("ai_providers")
        .select("id,name,provider_type,model")
        .eq("is_active", true)
        .order("is_recommended", { ascending: false })
        .limit(1)
        .maybeSingle();
      row = (any_ as any) ?? null;
    }
  }

  if (!row) throw new Error("Nenhum provedor de IA ativo cadastrado. Configure em Configurações > Provedores de IA.");

  // Busca API key no Vault
  const { data: keyData, error: vaultErr } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  if (vaultErr) console.error(`[VAULT] Falha ao buscar key para "${row.name}":`, vaultErr.message);

  const apiKey = typeof keyData === "string" && keyData.trim().length > 0 ? keyData.trim() : null;
  if (!apiKey) throw new Error(`API key não configurada para "${row.name}". Configure no painel administrativo.`);

  const model = row.model ?? "gpt-4o";
  return { providerType: row.provider_type, apiKey, model, name: row.name };
}

// ─────────────────────────────────────────────────────────────
// Chamadas às APIs de IA
// ─────────────────────────────────────────────────────────────
async function callOpenAI(prompt: string, apiKey: string, model = "gpt-4o"): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },  // força JSON puro
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string, apiKey: string, model = "claude-3-5-sonnet-20241022"): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callGemini(prompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  const m = model.replace("google/", "");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Gemini [${res.status}]: ${data.error?.message ?? res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callLovable(prompt: string, apiKey: string, model = "google/gemini-2.5-flash"): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Lovable [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callPerplexity(prompt: string, apiKey: string, model = "sonar"): Promise<string> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Perplexity [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAI(type: Provider, prompt: string, apiKey: string, model?: string): Promise<string> {
  switch (type) {
    case "openai":     return callOpenAI(prompt, apiKey, model);
    case "anthropic":  return callAnthropic(prompt, apiKey, model);
    case "gemini":     return callGemini(prompt, apiKey, model);
    case "lovable":    return callLovable(prompt, apiKey, model);
    case "perplexity": return callPerplexity(prompt, apiKey, model);
  }
}

// ─────────────────────────────────────────────────────────────
// Parse do JSON retornado pela IA
// A IA deve retornar { "items": [...] } conforme instruído no prompt
// ─────────────────────────────────────────────────────────────
function parseAIResponse(raw: string): any[] {
  let text = raw.trim();

  // Remove blocos de código markdown se a IA os incluir
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tenta extrair o primeiro objeto JSON do texto
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido. Verifique o modelo e o prompt.");
    parsed = JSON.parse(match[0]);
  }

  // Aceita { items: [...] } ou array direto
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.efs))   return parsed.efs;

  throw new Error(`Estrutura JSON inesperada da IA: ${JSON.stringify(parsed).slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Autenticação ──────────────────────────────────────
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

    // ── 2. Parse e validação do body ─────────────────────────
    const body = await req.json().catch(() => ({}));
    const { project_id, sprint_ref, release_ref, redmine_ref, baseline_id, providerId, model, hu_texts } = body;

    if (!project_id || !UUID_REGEX.test(project_id)) {
      return new Response(JSON.stringify({ error: "project_id inválido ou ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (providerId && !UUID_REGEX.test(providerId)) {
      return new Response(JSON.stringify({ error: "providerId deve ser um UUID válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Cliente admin para RPCs ───────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 4. Abre a sessão de contagem ─────────────────────────
    const { data: sessionId, error: sessionErr } = await admin.rpc("open_counting_session", {
      p_project_id:  project_id,
      p_sprint_ref:  sprint_ref  ?? null,
      p_release_ref: release_ref ?? null,
      p_redmine_ref: redmine_ref ?? null,
      p_baseline_id: baseline_id ?? null,
    });
    if (sessionErr) throw new Error(`Falha ao abrir sessão: ${sessionErr.message}`);

    // ── 5. Monta o prompt dinâmico via RPC ───────────────────
    const { data: promptData, error: promptErr } = await admin.rpc("build_apf_prompt", {
      p_session_id: sessionId,
    });
    if (promptErr) throw new Error(`Falha ao montar prompt: ${promptErr.message}`);

    // Injeta as HUs se fornecidas pelo frontend
    const finalPrompt = hu_texts
      ? `${promptData}\n\n=== HISTÓRIAS DE USUÁRIO DA SPRINT ===\n${hu_texts}\n=== FIM DAS HISTÓRIAS ===`
      : promptData;

    // ── 6. Resolve provider e chama a IA ────────────────────
    const resolved = await resolveProvider(providerId);
    const aiModel  = model ?? resolved.model;

    console.log(`[apf-count] session=${sessionId} provider="${resolved.name}" model=${aiModel}`);

    const aiRaw = await callAI(resolved.providerType, finalPrompt, resolved.apiKey, aiModel);

    if (!aiRaw?.trim()) throw new Error("A IA retornou resposta vazia.");

    // ── 7. Parse do JSON ─────────────────────────────────────
    const items = parseAIResponse(aiRaw);

    if (!items.length) throw new Error("A IA não retornou nenhum item de contagem.");

    // ── 8. Persiste itens e atualiza totais ──────────────────
    const { data: summary, error: saveErr } = await admin.rpc("save_counting_items", {
      p_session_id: sessionId,
      p_items:      items,
      p_ai_model:   `${resolved.name} / ${aiModel}`,
    });
    if (saveErr) throw new Error(`Falha ao salvar itens: ${saveErr.message}`);

    // ── 9. Resposta ──────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:        true,
        session_id:     sessionId,
        inserted_items: summary.inserted_items,
        inserted_gz:    summary.inserted_gz,
        total_pf_bruto: summary.total_pf_bruto,
        total_pf_fs:    summary.total_pf_fs,
        total_functions: summary.total_functions,
        total_hus:      summary.total_hus,
        provider_used:  resolved.name,
        model_used:     aiModel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[apf-count] erro:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
