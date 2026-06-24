// deno-lint-ignore-file no-explicit-any
/**
 * Persiste a validação humana da contagem contratual APF.
 * Registra tipo, fator, PF Bruto e PF FS sugeridos e homologados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApfValidationPayload {
  counting_item_id?: string;
  session_id: string;
  project_id: string;
  team_id?: string;
  baseline_item_id?: string;
  hu_text: string;
  hu_title?: string;
  project_domain?: string;
  ai_functional_type: string;
  ai_factor_sigla?: string;
  ai_complexity: string;
  ai_pf_bruto?: number;
  ai_pf_fs?: number;
  ai_confidence_score?: number;
  ai_reasoning?: string;
  provider_id?: string;
  prompt_version_hash?: string;
  rag_was_used?: boolean;
  rag_case_count?: number;
  validated_functional_type: string;
  validated_factor_sigla?: string;
  validated_complexity: string;
  validated_pf_bruto?: number;
  validated_pf_fs?: number;
  correction_reason_code?: string;
  correction_notes?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function differs(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    return Math.abs(Number(a ?? 0) - Number(b ?? 0)) > 0.005;
  }
  return String(a ?? "") !== String(b ?? "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Token inválido" }, 401);

    const payload = (await req.json()) as ApfValidationPayload;
    if (
      !payload.session_id
      || !payload.project_id
      || !payload.hu_text
      || !payload.ai_functional_type
      || !payload.ai_complexity
      || !payload.validated_functional_type
      || !payload.validated_complexity
    ) {
      return json({ error: "Campos obrigatórios ausentes" }, 400);
    }

    const wasCorrectedContractual =
      differs(payload.ai_functional_type, payload.validated_functional_type)
      || differs(payload.ai_factor_sigla, payload.validated_factor_sigla)
      || differs(payload.ai_complexity, payload.validated_complexity)
      || differs(payload.ai_pf_bruto, payload.validated_pf_bruto)
      || differs(payload.ai_pf_fs, payload.validated_pf_fs);

    if (wasCorrectedContractual && !payload.correction_reason_code) {
      return json({
        error: "correction_reason_code é obrigatório quando o especialista corrige a sugestão da IA",
        was_corrected: true,
      }, 422);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from("apf_validation_events")
      .insert({
        counting_item_id: payload.counting_item_id ?? null,
        session_id: payload.session_id,
        project_id: payload.project_id,
        team_id: payload.team_id ?? null,
        baseline_item_id: payload.baseline_item_id ?? null,
        hu_text: payload.hu_text,
        hu_title: payload.hu_title ?? null,
        project_domain: payload.project_domain ?? null,
        ai_functional_type: payload.ai_functional_type,
        ai_factor_sigla: payload.ai_factor_sigla ?? null,
        ai_complexity: payload.ai_complexity,
        ai_pf_bruto: payload.ai_pf_bruto == null ? null : Math.round(payload.ai_pf_bruto),
        ai_pf_bruto_exact: payload.ai_pf_bruto ?? null,
        ai_pf_fs: payload.ai_pf_fs ?? null,
        ai_confidence_score: payload.ai_confidence_score ?? null,
        ai_reasoning: payload.ai_reasoning ?? null,
        provider_id: payload.provider_id ?? null,
        prompt_version_hash: payload.prompt_version_hash ?? null,
        rag_was_used: payload.rag_was_used ?? false,
        rag_case_count: payload.rag_case_count ?? 0,
        validated_functional_type: payload.validated_functional_type,
        validated_factor_sigla: payload.validated_factor_sigla ?? null,
        validated_complexity: payload.validated_complexity,
        validated_pf_bruto: payload.validated_pf_bruto == null
          ? null
          : Math.round(payload.validated_pf_bruto),
        validated_pf_bruto_exact: payload.validated_pf_bruto ?? null,
        validated_pf_fs: payload.validated_pf_fs ?? null,
        was_corrected_contractual: wasCorrectedContractual,
        correction_reason_code: wasCorrectedContractual
          ? payload.correction_reason_code
          : null,
        correction_notes: wasCorrectedContractual
          ? payload.correction_notes ?? null
          : null,
        corrected_by: wasCorrectedContractual ? user.id : null,
      })
      .select("id, was_corrected, was_corrected_contractual")
      .single();

    if (error) throw error;

    return json({
      success: true,
      event_id: data.id,
      was_corrected: Boolean(data.was_corrected || data.was_corrected_contractual),
    }, 201);
  } catch (error) {
    console.error("[apf-validate]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro interno",
    }, 500);
  }
});
