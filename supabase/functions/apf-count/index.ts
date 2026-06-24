// deno-lint-ignore-file no-explicit-any
/**
 * Endpoint transacional de contagem APF contratual.
 * A IA classifica; o banco resolve peso, fator, deduplicação e PF FS.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Candidate {
  id: string;
  item_ref: string;
  description: string;
  function_sigla: string;
  factor_sigla: string;
  category_sigla: string | null;
  complexity: string;
  is_measurable: boolean;
  match_score: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractHuRefs(text: string): string[] {
  return [...text.matchAll(/\bHU\s*(\d+(?:\.\d+)?)\b/gi)]
    .map((match) => `HU${match[1]}`.toUpperCase());
}

function parseItems(raw: string): any[] {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const starts = [clean.indexOf("{"), clean.indexOf("[")].filter((index) => index >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    const candidate = start >= 0
      ? clean.slice(start).match(/\{[\s\S]*\}/)?.[0] ?? clean.slice(start).match(/\[[\s\S]*\]/)?.[0]
      : null;
    if (!candidate) throw new Error("A IA não retornou JSON válido.");
    parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }

  const items = Array.isArray(parsed)
    ? parsed
    : parsed?.items ?? parsed?.efs ?? parsed?.functions ?? parsed?.result?.items ?? parsed?.data?.items;
  if (!Array.isArray(items) || !items.length) {
    throw new Error("A IA não retornou itens de classificação.");
  }
  return items;
}

function normalizeItems(
  rawItems: any[],
  candidates: Candidate[],
  context: any,
  huRef: string,
) {
  const allowedTypes = new Set([
    "N/A",
    ...(context.function_types ?? []).map((item: any) => String(item.sigla).toUpperCase()),
  ]);
  const allowedFactors = new Set([
    "N/A",
    ...(context.impact_factors ?? []).map((item: any) => String(item.sigla).toUpperCase()),
  ]);
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return rawItems.slice(0, 12).map((raw) => {
    const functionSigla = String(raw.function_sigla ?? "N/A").toUpperCase();
    const factorSigla = String(raw.factor_sigla ?? "N/A").toUpperCase();
    if (!allowedTypes.has(functionSigla)) throw new Error(`Tipo funcional inválido: ${functionSigla}`);
    if (!allowedFactors.has(factorSigla)) throw new Error(`Fator de impacto inválido: ${factorSigla}`);

    const baselineItemId = raw.baseline_item_id && candidateMap.has(String(raw.baseline_item_id))
      ? String(raw.baseline_item_id)
      : null;
    const baseline = baselineItemId ? candidateMap.get(baselineItemId) : undefined;

    return {
      baseline_item_id: baselineItemId,
      hu_ref: String(raw.hu_ref ?? huRef),
      ef_description: String(raw.ef_description ?? baseline?.description ?? "Elemento funcional"),
      function_sigla: functionSigla,
      factor_sigla: factorSigla,
      match_type: String(raw.match_type ?? (
        baselineItemId ? "baseline_similar" : functionSigla === "N/A" ? "non_measurable" : "new_function"
      )),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
      justification: String(raw.justification ?? ""),
      evidence_literal: String(raw.evidence_literal ?? ""),
      category_sigla: raw.category_sigla ?? baseline?.category_sigla ?? null,
      complexity: String(raw.complexity ?? baseline?.complexity ?? "Padrão"),
    };
  });
}

async function authenticate(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("Não autenticado");
  const token = header.slice(7);
  if (token === SERVICE_KEY) return;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: header } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Token inválido");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const {
      project_id,
      story_id,
      sprint_ref,
      release_ref,
      redmine_ref,
      baseline_id,
      providerId,
    } = body;

    if (!UUID.test(project_id ?? "") || !UUID.test(story_id ?? "")) {
      return json({
        success: false,
        error: "project_id e story_id válidos são obrigatórios",
      }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: story, error: storyError } = await admin
      .from("user_stories")
      .select("id,code,title,description,acceptance_criteria,sprint_id")
      .eq("id", story_id)
      .maybeSingle();
    if (storyError || !story) throw new Error("História de usuário não encontrada.");

    const storyText = [
      `Código interno: ${story.code}`,
      `Título: ${story.title}`,
      story.description ? `Descrição:\n${story.description}` : "",
      story.acceptance_criteria ? `Critérios de Aceite:\n${story.acceptance_criteria}` : "",
    ].filter(Boolean).join("\n\n");

    const { data: context, error: contextError } = await admin.rpc(
      "get_active_apf_context",
      { p_project_id: project_id },
    );
    if (contextError) throw new Error(`Contexto APF inválido: ${contextError.message}`);

    const activeBaselineId = baseline_id ?? context?.baseline?.id;
    if (!activeBaselineId) throw new Error("O projeto não possui baseline APF ativa.");

    const { data: sessionId, error: sessionError } = await admin.rpc(
      "open_counting_session",
      {
        p_project_id: project_id,
        p_sprint_ref: sprint_ref ?? story.sprint_id ?? null,
        p_release_ref: release_ref ?? null,
        p_redmine_ref: redmine_ref ?? null,
        p_baseline_id: activeBaselineId,
      },
    );
    if (sessionError) throw new Error(`Falha ao abrir sessão: ${sessionError.message}`);

    const { data: rows, error: candidatesError } = await admin.rpc(
      "get_apf_baseline_candidates",
      { p_project_id: project_id, p_story_text: storyText, p_limit: 12 },
    );
    if (candidatesError) throw new Error(`Falha ao consultar baseline: ${candidatesError.message}`);

    const candidates = (rows ?? []) as Candidate[];
    const huRefs = extractHuRefs(`${story.title}\n${story.description ?? ""}\n${story.code}`);
    const huRef = huRefs[0] ?? story.code;
    const exact = candidates.filter((candidate) => {
      const ref = String(candidate.item_ref ?? "").toUpperCase().replace(/\s+/g, "");
      return huRefs.length ? huRefs.includes(ref) : Number(candidate.match_score) >= 0.999;
    });

    let items: any[];
    let providerUsed = "Baseline determinística";
    let deterministicMatch = false;

    if (exact.length) {
      deterministicMatch = true;
      items = exact.map((candidate) => ({
        baseline_item_id: candidate.id,
        hu_ref: huRef,
        ef_description: candidate.description,
        function_sigla: candidate.is_measurable ? candidate.function_sigla : "N/A",
        factor_sigla: candidate.is_measurable ? candidate.factor_sigla : "N/A",
        match_type: "baseline_exact",
        confidence: 1,
        justification: "Correspondência exata com item homologado na baseline ativa.",
        evidence_literal: story.title,
        category_sigla: candidate.category_sigla,
        complexity: candidate.complexity,
      }));
    } else {
      let selectedProviderId = providerId;
      if (!selectedProviderId) {
        const { data: provider } = await admin
          .from("ai_providers")
          .select("id")
          .eq("is_active", true)
          .order("is_recommended", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        selectedProviderId = provider?.id;
      }
      if (!selectedProviderId) throw new Error("Nenhum provedor de IA ativo foi encontrado.");

      const { data: prompt, error: promptError } = await admin.rpc(
        "build_apf_prompt",
        { p_session_id: sessionId },
      );
      if (promptError) throw new Error(`Falha ao montar prompt: ${promptError.message}`);

      const candidateBlock = candidates.map((candidate, index) => ({
        rank: index + 1,
        baseline_item_id: candidate.id,
        item_ref: candidate.item_ref,
        description: candidate.description,
        function_sigla: candidate.function_sigla,
        factor_sigla: candidate.factor_sigla,
        measurable: candidate.is_measurable,
        similarity: candidate.match_score,
      }));
      const classificationPrompt = [
        String(prompt.system_prompt),
        "Classifique a HU usando a baseline e o modelo contratual. Não calcule PF.",
        `HU:\n${storyText}`,
        `CANDIDATOS DA BASELINE:\n${JSON.stringify(candidateBlock, null, 2)}`,
        "Retorne somente o JSON solicitado. Prefira consolidar e não invente funções.",
      ].join("\n\n");

      const generationResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/apf-generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: classificationPrompt,
            providerId: selectedProviderId,
            skipDocx: true,
          }),
        },
      );
      const generation = await generationResponse.json();
      if (!generationResponse.ok || !generation?.success || !generation?.markdown) {
        throw new Error(
          generation?.userMessage
          ?? generation?.rawError
          ?? generation?.error
          ?? "A IA não retornou a classificação.",
        );
      }

      items = normalizeItems(parseItems(generation.markdown), candidates, context, huRef);
      providerUsed = generation.providerUsed ?? "IA";
    }

    const { data: summary, error: saveError } = await admin.rpc(
      "save_contractual_counting_items",
      {
        p_session_id: sessionId,
        p_story_id: story_id,
        p_items: items,
        p_ai_model: providerUsed,
      },
    );
    if (saveError) throw new Error(`Falha ao persistir contagem: ${saveError.message}`);

    return json({
      success: true,
      ...summary,
      provider_used: providerUsed,
      deterministic_match: deterministicMatch,
      baseline_id: activeBaselineId,
      baseline_version: context?.baseline?.version,
    });
  } catch (error) {
    console.error("[apf-count]", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return json(
      { success: false, error: message },
      /não autenticado|token inválido/i.test(message) ? 401 : 500,
    );
  }
});
