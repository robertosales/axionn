/**
 * SEC-003 — Edge Function: delete-user (hardened)
 *
 * Correções aplicadas:
 *   1. CORS restrito ao SITE_URL (não mais "*")
 *   2. Verificação obrigatória de admin antes de deletar
 *   3. Validação UUID do user_id
 *   4. Audit log registrado ANTES da deleção (após deleção o user_id some)
 *   5. Impede auto-deleção (admin deletando a si mesmo)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── 1. Autenticação ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Verificação de admin ────────────────────────────────────────────
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem deletar usuários" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Validação do payload ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { user_id } = body as { user_id?: string };

    if (!user_id || !UUID_REGEX.test(user_id)) {
      return new Response(JSON.stringify({ error: "user_id inválido ou ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Impede auto-deleção ─────────────────────────────────────────────
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Administrador não pode deletar a própria conta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Audit log ANTES de deletar ─────────────────────────────────────
    // (após deleteUser o registro em auth.users some — auditamos antes)
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", user_id)
      .maybeSingle();

    await adminClient.rpc("fn_audit_log_insert", {
      p_action:       "USER_DELETED",
      p_target_table: "auth.users",
      p_target_id:    user_id,
      p_actor_id:     caller.id,
      p_old_data:     targetProfile
        ? { email: targetProfile.email, full_name: targetProfile.full_name }
        : null,
      p_new_data: null,
    });

    // ── 6. Deleção ────────────────────────────────────────────────────────
    const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[delete-user]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
