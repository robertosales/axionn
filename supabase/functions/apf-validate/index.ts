/**
 * Edge Function: apf-validate
 * Recebe o payload de validação humana de um item APF e persiste
 * em apf_validation_events de forma estruturada.
 *
 * POST /apf-validate
 * Body: ApfValidationPayload
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface ApfValidationPayload {
  // Vínculo
  counting_item_id?: string;
  session_id: string;
  project_id: string;
  team_id?: string;

  // Texto da HU
  hu_text: string;
  hu_title?: string;
  project_domain?: string;

  // O que a IA disse
  ai_functional_type: string;
  ai_complexity: string;
  ai_pf_bruto?: number;
  ai_confidence_score?: number;
  ai_reasoning?: string;
  provider_id?: string;
  prompt_version_hash?: string;
  rag_was_used?: boolean;
  rag_case_count?: number;

  // O que o especialista decidiu
  validated_functional_type: string;
  validated_complexity: string;
  validated_pf_bruto?: number;

  // Motivo da correção (obrigatório quando houve correção)
  correction_reason_code?: string;
  correction_notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Usa service_role para bypass de RLS (operação interna confiável)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: ApfValidationPayload = await req.json();

    // Validação mínima
    if (!payload.session_id || !payload.hu_text ||
        !payload.ai_functional_type || !payload.validated_functional_type) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detecta correção
    const was_corrected =
      payload.ai_functional_type !== payload.validated_functional_type ||
      payload.ai_complexity !== payload.validated_complexity;

    // Exige motivo quando há correção
    if (was_corrected && !payload.correction_reason_code) {
      return new Response(
        JSON.stringify({
          error: "correction_reason_code é obrigatório quando o especialista corrige a sugestão da IA",
          was_corrected,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recupera corrected_by do JWT (usuário autenticado que chamou a função)
    const authHeader = req.headers.get("Authorization") ?? "";
    let corrected_by: string | null = null;
    if (was_corrected && authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      corrected_by = user?.id ?? null;
    }

    const { data, error } = await supabase
      .from("apf_validation_events")
      .insert({
        counting_item_id:          payload.counting_item_id ?? null,
        session_id:                payload.session_id,
        project_id:                payload.project_id,
        team_id:                   payload.team_id ?? null,
        hu_text:                   payload.hu_text,
        hu_title:                  payload.hu_title ?? null,
        project_domain:            payload.project_domain ?? null,
        ai_functional_type:        payload.ai_functional_type,
        ai_complexity:             payload.ai_complexity,
        ai_pf_bruto:               payload.ai_pf_bruto ?? null,
        ai_confidence_score:       payload.ai_confidence_score ?? null,
        ai_reasoning:              payload.ai_reasoning ?? null,
        provider_id:               payload.provider_id ?? null,
        prompt_version_hash:       payload.prompt_version_hash ?? null,
        rag_was_used:              payload.rag_was_used ?? false,
        rag_case_count:            payload.rag_case_count ?? 0,
        validated_functional_type: payload.validated_functional_type,
        validated_complexity:      payload.validated_complexity,
        validated_pf_bruto:        payload.validated_pf_bruto ?? null,
        correction_reason_code:    was_corrected ? payload.correction_reason_code : null,
        correction_notes:          was_corrected ? (payload.correction_notes ?? null) : null,
        corrected_by:              was_corrected ? corrected_by : null,
      })
      .select("id, was_corrected")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, event_id: data.id, was_corrected: data.was_corrected }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("apf-validate error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
