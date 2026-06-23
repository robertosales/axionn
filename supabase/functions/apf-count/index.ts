// deno-lint-ignore-file no-explicit-any
/**
 * apf-count — Edge Function
 *
 * Fluxo completo de contagem APF em um único endpoint:
 *   1. open_counting_session()       — cria sessão no banco
 *   2. check_license_quota()         — bloqueia se cota esgotada (HTTP 402)
 *   3. build_apf_prompt()            — monta prompt dinâmico com regras do modelo
 *   4. [RAG] generateQueryEmbedding  — vetoriza o texto das HUs
 *   5. [RAG] match_similar_apf_cases — busca casos similares validados
 *   6. [RAG] buildRagContext()        — formata e injeta casos no prompt
 *   7. Chama a IA                    — retorna JSON estruturado com os EFs
 *   8. save_counting_items()         — persiste itens, gray_zones e totais
 *   9. increment_license_usage()     — registra 1 chamada IA + total de PF-US
 *  10. Retorna resumo ao frontend    — inclui rag_case_count e rag_was_used
 *
 * Body esperado:
 *   {
 *     project_id:       string (UUID, obrigatório)
 *     sprint_ref:       string (ex: "Sprint 01")
 *     release_ref:      string (ex: "Release 05")
 *     redmine_ref:      string (ex: "25044")
 *     baseline_id:      string (UUID, opcional)
 *     providerId:       string (UUID, opcional — usa openai/gpt-4o se omitido)
 *     model:            string (opcional — override do modelo do provider)
 *     hu_texts:         string (opcional — texto bruto das HUs para injetar no prompt)
 *     project_domain:   string (opcional — 'financeiro'|'saúde'|'governo'|'varejo'|...)
 *     rag_enabled:      boolean (opcional — default true; false desativa RAG)
 *   }
 *
 * Resposta de sucesso:
 *   {
 *     success: true,
 *     session_id, inserted_items, inserted_gz,
 *     total_pf_bruto, total_pf_fs, total_functions, total_hus,
 *     provider_used, model_used,
 *     ai_remaining,
 *     rag_was_used,      // boolean: RAG foi ativado e encontrou casos
 *     rag_case_count     // número de casos similares injetados no prompt
 *   }
 *
 * CHANGELOG:
 *   FIX-003 (2026-06-22) — Suporte ao provedor Sakana AI
 *   STAGE-3 (2026-06-23) — RAG ativo: busca semântica + injeção no prompt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL     = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Provider = "openai" | "anthropic" | "gemini" | "lovable" | "perplexity" | "sakana";

// ─────────────────────────────────────────────────────────────
// RAG — Configurações
// ─────────────────────────────────────────────────────────────
const RAG_SIMILARITY_THRESHOLD = 0.80;  // mínimo de similaridade coseno
const RAG_MAX_CASES            = 5;     // máximo de casos injetados no prompt
const EMBEDDING_MODEL          = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS     = 1536;

/**
 * Gera o embedding vetorial de um texto usando a API da OpenAI.
 * Sempre usa OpenAI para embeddings (independente do provider de contagem),
 * garantindo compatibilidade com os vetores já armazenados no banco.
 */
async function generateQueryEmbedding(
  text: string,
  openaiKey: string,
): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!res.ok) {
      console.warn(`[RAG] Embedding API error ${res.status}:`, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[RAG] generateQueryEmbedding falhou:", err);
    return null;
  }
}

interface SimilarCase {
  id: string;
  hu_text: string;
  hu_title: string | null;
  validated_functional_type: string;
  validated_complexity: string;
  validated_pf_bruto: number | null;
  was_corrected: boolean;
  correction_reason_code: string | null;
  domain: string | null;
  similarity: number;
}

/**
 * Busca casos APF similares via pgvector.
 * Prioriza casos do mesmo time e domínio, mas também retorna globais.
 */
async function fetchSimilarCases(
  admin: ReturnType<typeof createClient>,
  embedding: number[],
  teamId: string | null,
  domain: string | null,
): Promise<SimilarCase[]> {
  try {
    const { data, error } = await admin.rpc("match_similar_apf_cases", {
      p_query_embedding:    `[${embedding.join(",")}]`,
      p_team_id:            teamId,
      p_domain:             domain,
      p_limit:              RAG_MAX_CASES,
      p_similarity_threshold: RAG_SIMILARITY_THRESHOLD,
    });
    if (error) {
      console.warn("[RAG] match_similar_apf_cases error:", error.message);
      return [];
    }
    return (data as SimilarCase[]) ?? [];
  } catch (err) {
    console.warn("[RAG] fetchSimilarCases falhou:", err);
    return [];
  }
}

/**
 * Formata os casos similares em bloco de contexto para injetar no prompt.
 * O formato é projetado para ser lido pelo modelo de contagem APF.
 */
function buildRagContext(cases: SimilarCase[]): string {
  if (!cases.length) return "";

  const lines = cases.map((c, i) => {
    const title = c.hu_title ?? c.hu_text.slice(0, 100);
    const similarity = Math.round(c.similarity * 100);
    const status = c.was_corrected
      ? `⚠️  IA havia errado (motivo: ${c.correction_reason_code ?? "não informado"}) — use a classificação validada`
      : `✅ IA acertou — classificação confirmada por especialista`;

    return [
      `--- Caso ${i + 1} (${similarity}% similar) ---`,
      `HU: "${title}"`,
      `Tipo funcional: ${c.validated_functional_type}`,
      `Complexidade:   ${c.validated_complexity}`,
      `PF:             ${c.validated_pf_bruto ?? "n/a"}`,
      `Status:         ${status}`,
    ].join("\n");
  });

  return [
    "=== CASOS APF SIMILARES JÁ VALIDADOS POR ESPECIALISTAS ===",
    "Use estes casos como referência para sua classificação.",
    "Casos com ⚠️ indicam onde a IA errou anteriormente — preste atenção redobrada.",
    "",
    lines.join("\n\n"),
    "=== FIM DOS CASOS DE REFERÊNCIA ===",
  ].join("\n");
}

/**
 * Busca a API key da OpenAI para uso exclusivo nos embeddings RAG.
 * Tenta o vault primeiro; se falhar, tenta variável de ambiente.
 */
async function resolveOpenAIKeyForEmbedding(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  try {
    // 1. Tenta buscar do vault via RPC padrão do sistema
    const { data } = await admin
      .from("ai_providers")
      .select("id")
      .eq("provider_type", "openai")
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      const { data: keyData } = await admin.rpc("get_ai_provider_key_by_id", { p_id: data.id });
      if (typeof keyData === "string" && keyData.trim().length > 0) return keyData.trim();
    }
  } catch { /* ignora — fallback abaixo */ }

  // 2. Fallback: variável de ambiente direta
  return Deno.env.get("OPENAI_API_KEY") ?? null;
}

// ─────────────────────────────────────────────────────────────
// Resolução de provider de contagem
// ─────────────────────────────────────────────────────────────
async function resolveProvider(providerId?: string): Promise<{
  providerType: Provider;
  apiKey: string;
  model: string;
  name: string;
  providerId: string;
}> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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
    const { data } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model")
      .eq("provider_type", "openai")
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as any) ?? null;

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

  const { data: keyData, error: vaultErr } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  if (vaultErr) console.error(`[VAULT] Falha ao buscar key para "${row.name}":`, vaultErr.message);

  const apiKey = typeof keyData === "string" && keyData.trim().length > 0 ? keyData.trim() : null;
  if (!apiKey) throw new Error(`API key não configurada para "${row.name}". Configure no painel administrativo.`);

  const model = row.model ?? "gpt-4o";
  return { providerType: row.provider_type, apiKey, model, name: row.name, providerId: row.id };
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
      response_format: { type: "json_object" },
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

async function callSakana(prompt: string, apiKey: string, model = "fugu"): Promise<string> {
  const res = await fetch("https://api.sakana.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      reasoning: { effort: "high" },
    }),
  });
  if (!res.ok) throw new Error(`Sakana [${res.status}]: ${await res.text()}`);
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
    case "sakana":     return callSakana(prompt, apiKey, model);
  }
}

// ─────────────────────────────────────────────────────────────
// Parse do JSON retornado pela IA
// ─────────────────────────────────────────────────────────────
function parseAIResponse(raw: string): any[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido. Verifique o modelo e o prompt.");
    parsed = JSON.parse(match[0]);
  }

  if (Array.isArray(parsed))        return parsed;
  if (Array.isArray(parsed.items))  return parsed.items;
  if (Array.isArray(parsed.efs))    return parsed.efs;

  throw new Error(`Estrutura JSON inesperada da IA: ${JSON.stringify(parsed).slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────
// Resolve team_id a partir do project_id
// ─────────────────────────────────────────────────────────────
async function resolveTeamId(admin: ReturnType<typeof createClient>, projectId: string): Promise<string | null> {
  const { data } = await admin
    .from("projects")
    .select("team_id")
    .eq("id", projectId)
    .maybeSingle();
  return (data as any)?.team_id ?? null;
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
    // ── 1. Autenticação ───────────────────────────────────────────────
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

    // ── 2. Parse e validação do body ─────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const {
      project_id, sprint_ref, release_ref, redmine_ref,
      baseline_id, providerId, model, hu_texts,
      project_domain = null,
      rag_enabled = true,
    } = body;

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

    // ── 3. Cliente admin ───────────────────────────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 4. Resolve team_id ──────────────────────────────────────────────
    const teamId = await resolveTeamId(admin, project_id);

    // ── 5. Guardrail: verifica quota ANTES da IA ─────────────────────────
    if (teamId) {
      const { data: quota, error: quotaErr } = await admin.rpc("check_license_quota", {
        p_team_id: teamId,
      });
      if (quotaErr) {
        console.warn("[apf-count] check_license_quota falhou:", quotaErr.message);
      } else if (quota && quota.allowed === false) {
        const reason = quota.reason ?? "Cota de chamadas à IA esgotada para este mês.";
        console.warn(`[apf-count] quota bloqueada — team=${teamId} reason="${reason}"`);
        return new Response(
          JSON.stringify({
            success:      false,
            error:        reason,
            ai_remaining: quota.ai_remaining ?? 0,
            pf_remaining: quota.pf_remaining ?? 0,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── 6. Abre a sessão de contagem ──────────────────────────────────
    const { data: sessionId, error: sessionErr } = await admin.rpc("open_counting_session", {
      p_project_id:  project_id,
      p_sprint_ref:  sprint_ref  ?? null,
      p_release_ref: release_ref ?? null,
      p_redmine_ref: redmine_ref ?? null,
      p_baseline_id: baseline_id ?? null,
    });
    if (sessionErr) throw new Error(`Falha ao abrir sessão: ${sessionErr.message}`);

    // ── 7. Monta o prompt dinâmico via RPC ─────────────────────────────
    const { data: promptData, error: promptErr } = await admin.rpc("build_apf_prompt", {
      p_session_id: sessionId,
    });
    if (promptErr) throw new Error(`Falha ao montar prompt: ${promptErr.message}`);

    // Injeta hu_texts no prompt base
    const basePrompt = hu_texts
      ? `${promptData}\n\n=== HISTÓRIAS DE USUÁRIO DA SPRINT ===\n${hu_texts}\n=== FIM DAS HISTÓRIAS ===`
      : promptData;

    // ── 8. [RAG] Busca casos similares e injeta no prompt ────────────────
    let ragWasUsed  = false;
    let ragCaseCount = 0;
    let finalPrompt = basePrompt;

    if (rag_enabled && hu_texts?.trim()) {
      // Busca a key OpenAI para embedding (independente do provider de contagem)
      const openaiKey = await resolveOpenAIKeyForEmbedding(admin);

      if (openaiKey) {
        console.log(`[RAG] Gerando embedding para team=${teamId} domain=${project_domain}`);

        const embedding = await generateQueryEmbedding(hu_texts, openaiKey);

        if (embedding) {
          const similarCases = await fetchSimilarCases(admin, embedding, teamId, project_domain);
          ragCaseCount = similarCases.length;

          if (ragCaseCount > 0) {
            ragWasUsed  = true;
            const ragContext = buildRagContext(similarCases);

            // Injeta o contexto RAG ANTES das HUs — o modelo lê os exemplos antes de classificar
            finalPrompt = hu_texts
              ? `${promptData}\n\n${ragContext}\n\n=== HISTÓRIAS DE USUÁRIO DA SPRINT ===\n${hu_texts}\n=== FIM DAS HISTÓRIAS ===`
              : `${promptData}\n\n${ragContext}`;

            console.log(`[RAG] ${ragCaseCount} casos similares injetados no prompt (team=${teamId})`);
          } else {
            console.log(`[RAG] Nenhum caso acima do threshold ${RAG_SIMILARITY_THRESHOLD} encontrado`);
          }
        } else {
          console.warn("[RAG] Embedding gerado como null — seguindo sem RAG");
        }
      } else {
        console.warn("[RAG] OpenAI key não disponível — seguindo sem RAG");
      }
    } else {
      if (!rag_enabled) console.log("[RAG] Desativado explicitamente pelo caller");
      if (!hu_texts?.trim()) console.log("[RAG] hu_texts vazio — não há o que vetorizar");
    }

    // ── 9. Resolve provider e chama a IA ──────────────────────────────
    const resolved = await resolveProvider(providerId);
    const aiModel  = model ?? resolved.model;

    console.log(`[apf-count] session=${sessionId} provider="${resolved.name}" model=${aiModel} rag=${ragWasUsed}(${ragCaseCount} casos)`);

    const aiRaw = await callAI(resolved.providerType, finalPrompt, resolved.apiKey, aiModel);

    if (!aiRaw?.trim()) throw new Error("A IA retornou resposta vazia.");

    // ── 10. Parse do JSON ───────────────────────────────────────────────
    const items = parseAIResponse(aiRaw);
    if (!items.length) throw new Error("A IA não retornou nenhum item de contagem.");

    // ── 11. Persiste itens e atualiza totais ────────────────────────────
    const { data: summary, error: saveErr } = await admin.rpc("save_counting_items", {
      p_session_id: sessionId,
      p_items:      items,
      p_ai_model:   `${resolved.name} / ${aiModel}`,
    });
    if (saveErr) throw new Error(`Falha ao salvar itens: ${saveErr.message}`);

    // ── 12. Incrementa uso na licença ───────────────────────────────────
    if (teamId) {
      const totalPfUs: number = summary?.total_pf_fs ?? 0;
      const { error: incErr } = await admin.rpc("increment_license_usage", {
        p_team_id:  teamId,
        p_pf_count: totalPfUs,
        p_ai_calls: 1,
      });
      if (incErr) {
        console.error("[apf-count] increment_license_usage falhou:", incErr.message);
      } else {
        console.log(`[apf-count] uso registrado — team=${teamId} pf=${totalPfUs} ai_calls=1`);
      }
    }

    // ── 13. Busca cotas atualizadas ──────────────────────────────────────
    let aiRemaining: number | null = null;
    let pfRemaining: number | null = null;
    if (teamId) {
      const { data: quotaPost } = await admin.rpc("check_license_quota", { p_team_id: teamId });
      if (quotaPost) {
        aiRemaining = quotaPost.ai_remaining ?? null;
        pfRemaining = quotaPost.pf_remaining ?? null;
      }
    }

    // ── 14. Resposta ──────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:         true,
        session_id:      sessionId,
        inserted_items:  summary.inserted_items,
        inserted_gz:     summary.inserted_gz,
        total_pf_bruto:  summary.total_pf_bruto,
        total_pf_fs:     summary.total_pf_fs,
        total_functions: summary.total_functions,
        total_hus:       summary.total_hus,
        provider_used:   resolved.name,
        model_used:      aiModel,
        ai_remaining:    aiRemaining,
        pf_remaining:    pfRemaining,
        // — RAG metadata (para rastreio no apf-validate e no dashboard)
        rag_was_used:    ragWasUsed,
        rag_case_count:  ragCaseCount,
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
