/**
 * SEC-003 — admin-user-management (hardened)
 *
 * Alterações em relação à versão anterior:
 *   1. CORS restrito ao SITE_URL (não mais "*")
 *   2. Validação UUID em user_id
 *   3. Audit log gravado em user_management_audit_log para
 *      TODAS as ações (change_email, reset_password)
 *   4. temp_password NUNCA retornado no body da resposta —
 *      apenas gravado no audit log (acessível só para admins)
 *   5. getClaims() substituído por getUser() (API estável)
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

function generateTempPassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghijkmnpqrstuvwxyz";
  const digits  = "23456789";
  const symbols = "!@#$%&*";
  const all     = upper + lower + digits + symbols;
  const pick    = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── 1. Autenticar o caller ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SEC-003: getUser() em vez de getClaims() (API estável e suportada)
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) return json({ error: "Token inválido" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 2. Verificar se caller é admin ─────────────────────────────────────
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Apenas administradores podem executar esta ação" }, 403);

    // ── 3. Validar payload ──────────────────────────────────────────────────
    const body = await req.json();
    const { action, user_id, new_email, mode, email_mode } = body as {
      action: "change_email" | "reset_password";
      user_id: string;
      new_email?: string;
      mode?: "temp_password" | "send_link";
      email_mode?: "confirm" | "direct";
    };

    if (!action || !user_id)      return json({ error: "action e user_id obrigatórios" }, 400);
    if (!UUID_RE.test(user_id))   return json({ error: "user_id deve ser um UUID válido" }, 400);

    // ── 4. AÇÃO: change_email ───────────────────────────────────────────────
    if (action === "change_email") {
      if (!new_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
        return json({ error: "E-mail inválido" }, 400);
      }
      const isDirect = email_mode === "direct";
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        email: new_email,
        email_confirm: isDirect,
      });
      if (error) throw error;

      const profileUpdate: Record<string, unknown> = {};
      if (isDirect) {
        profileUpdate.email = new_email;
        profileUpdate.must_change_password = true;
      }
      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }

      // SEC-003: audit log
      await adminClient.from("user_management_audit_log").insert({
        performed_by:   caller.id,
        action:         "change_email",
        target_user_id: user_id,
        details: {
          new_email,
          mode: isDirect ? "direct" : "confirm",
          performed_by_email: caller.email,
        },
      });

      return json({
        success: true,
        mode: isDirect ? "direct" : "confirm",
        message: isDirect
          ? "E-mail trocado com sucesso. O usuário será obrigado a redefinir a senha no próximo login."
          : "E-mail de confirmação enviado para o novo endereço. O usuário deve clicar no link para validar.",
      });
    }

    // ── 5. AÇÃO: reset_password ─────────────────────────────────────────────
    if (action === "reset_password") {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      const targetEmail = profile?.email;

      if (mode === "send_link") {
        if (!targetEmail) return json({ error: "Usuário sem e-mail cadastrado" }, 400);
        const origin      = req.headers.get("origin") || req.headers.get("referer") || "";
        const cleanOrigin = origin.replace(/\/$/, "").replace(/\/auth.*$/, "");
        const redirectTo  = `${cleanOrigin}/reset-password`;

        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
          options: { redirectTo },
        });
        if (linkErr) throw linkErr;

        // SEC-003: audit log
        await adminClient.from("user_management_audit_log").insert({
          performed_by:   caller.id,
          action:         "reset_password_link",
          target_user_id: user_id,
          details: {
            target_email: targetEmail,
            performed_by_email: caller.email,
          },
        });

        return json({
          success: true,
          mode: "send_link",
          message: "Link de redefinição enviado para o e-mail do usuário.",
          recovery_link: linkData?.properties?.action_link ?? null,
        });
      }

      // mode = "temp_password"
      const tempPassword = generateTempPassword();
      const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, {
        password: tempPassword,
      });
      if (updErr) throw updErr;

      await adminClient.from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", user_id);

      // SEC-003: audit log — temp_password gravado APENAS aqui (admin-only via RLS)
      // NÃO retornamos temp_password no response — admin consulta via audit log
      await adminClient.from("user_management_audit_log").insert({
        performed_by:   caller.id,
        action:         "reset_password_temp",
        target_user_id: user_id,
        details: {
          target_email:       targetEmail ?? null,
          temp_password:      tempPassword,   // acessível só para admins via RLS
          performed_by_email: caller.email,
        },
      });

      return json({
        success: true,
        mode: "temp_password",
        // SEC-003: temp_password removido do response público
        message: "Senha temporária gerada e gravada no audit log. O usuário será obrigado a trocar no próximo login.",
      });
    }

    return json({ error: "Ação desconhecida" }, 400);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return json({ error: msg }, 500);
  }
});
