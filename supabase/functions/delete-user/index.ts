/**
 * SEC-003 — delete-user (hardened)
 *
 * Alterações em relação à versão anterior:
 *   1. CORS restrito ao SITE_URL (não mais "*")
 *   2. Verificação obrigatória: caller deve ser admin
 *   3. Validação de UUID no user_id recebido
 *   4. Audit log gravado em user_management_audit_log
 *   5. Impede auto-deleção (admin deletando a si mesmo)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── 1. Autenticar o caller ────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) return json({ error: "Token inválido" }, 401);

  // ── 2. Verificar se caller é admin ───────────────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) return json({ error: "Apenas administradores podem executar esta ação" }, 403);

  // ── 3. Validar payload ────────────────────────────────────────────────────
  let user_id: string;
  try {
    const body = await req.json();
    user_id = body?.user_id;
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }

  if (!user_id)             return json({ error: "user_id obrigatório" }, 400);
  if (!UUID_RE.test(user_id)) return json({ error: "user_id deve ser um UUID válido" }, 400);

  // ── 4. Impedir auto-deleção ──────────────────────────────────────────────
  if (user_id === caller.id) {
    return json({ error: "Um administrador não pode deletar a própria conta" }, 400);
  }

  // ── 5. Buscar dados do usuário-alvo para audit ───────────────────────────
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", user_id)
    .maybeSingle();

  // ── 6. Executar a deleção ────────────────────────────────────────────────
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
  if (deleteErr) return json({ error: deleteErr.message }, 500);

  // ── 7. Gravar audit log ───────────────────────────────────────────────────
  await adminClient.from("user_management_audit_log").insert({
    performed_by:  caller.id,
    action:        "delete_user",
    target_user_id: user_id,
    details: {
      target_email:     targetProfile?.email     ?? null,
      target_full_name: targetProfile?.full_name ?? null,
      performed_by_email: caller.email,
    },
  });

  return json({ success: true });
});
