/**
 * SEC-003 + SEC-004 — Edge Function: admin-user-management (hardened)
 *
 * SEC-003: CORS restrito, validação UUID, audit log, impede ação sobre si mesmo
 * SEC-004: Migrado de SUPABASE_SERVICE_ROLE_KEY para SUPABASE_SECRET_KEYS
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SITE_URL deve ser a URL do frontend em produção (ex: https://axion.lovable.app)
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:8080";
const EXPOSE_TEMP_PWD = Deno.env.get("EXPOSE_TEMP_PASSWORD") !== "false";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SEC-004: novas env vars (com fallback para compatibilidade durante transição)
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const _secretKeys   = Deno.env.get("SUPABASE_SECRET_KEYS");
const _publishKeys  = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
let SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY");

if (_secretKeys) {
  try {
    const keys = JSON.parse(_secretKeys);
    if (keys.service_role) SERVICE_KEY = keys.service_role;
  } catch (e) {
    console.error("[admin-user-management] Falha ao parsear SUPABASE_SECRET_KEYS:", e);
  }
}

if (_publishKeys) {
  try {
    const pKeys = JSON.parse(_publishKeys);
    if (pKeys.anon) ANON_KEY = pKeys.anon;
  } catch (e) {
    console.error("[admin-user-management] Falha ao parsear SUPABASE_PUBLISHABLE_KEYS:", e);
  }
}

if (!SERVICE_KEY || !ANON_KEY) {
  throw new Error("Credenciais do Supabase (SERVICE_KEY/ANON_KEY) não encontradas.");
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
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
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta ação" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Validação do payload ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { action, user_id, new_email, mode, email_mode } = body as {
      action:      "change_email" | "reset_password";
      user_id:     string;
      new_email?:  string;
      mode?:       "temp_password" | "send_link";
      email_mode?: "confirm" | "direct";
    };

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action e user_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!UUID_REGEX.test(user_id)) {
      return new Response(JSON.stringify({ error: "user_id deve ser um UUID válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Impede ação sobre si mesmo ─────────────────────────────────────
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Use as configurações de perfil para alterar seus próprios dados" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auditLog = async (
      auditAction: string,
      oldData: Record<string, unknown> | null,
      newData:  Record<string, unknown> | null
    ) => {
      try {
        const { error } = await adminClient.rpc("fn_audit_log_insert", {
          p_action:       auditAction,
          p_target_table: "profiles",
          p_target_id:    user_id,
          p_actor_id:     caller.id,
          p_old_data:     oldData,
          p_new_data:     newData,
        });
        if (error) console.error("[admin-user-management] Erro RPC Auditoria:", error.message);
      } catch (e) {
        console.error("[admin-user-management] Falha na auditoria (best-effort):", e);
      }
    };

    // ── 5. AÇÃO: change_email ──────────────────────────────────────────────
    if (action === "change_email") {
      if (!new_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
        return new Response(JSON.stringify({ error: "E-mail inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: currentProfile } = await adminClient
        .from("profiles").select("email").eq("user_id", user_id).maybeSingle();

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

      await auditLog(
        "EMAIL_CHANGED",
        { email: currentProfile?.email ?? null, mode: isDirect ? "direct" : "confirm" },
        { email: new_email, mode: isDirect ? "direct" : "confirm" }
      );

      return new Response(
        JSON.stringify({
          success: true,
          mode: isDirect ? "direct" : "confirm",
          message: isDirect
            ? "E-mail trocado com sucesso. O usuário será obrigado a redefinir a senha no próximo login."
            : "E-mail de confirmação enviado para o novo endereço.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 6. AÇÃO: reset_password ────────────────────────────────────────────
    if (action === "reset_password") {
      const { data: profile } = await adminClient
        .from("profiles").select("email").eq("user_id", user_id).maybeSingle();
      const targetEmail = profile?.email;

      if (mode === "send_link") {
        if (!targetEmail) {
          return new Response(JSON.stringify({ error: "Usuário sem e-mail cadastrado" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const origin      = req.headers.get("origin") ?? req.headers.get("referer") ?? SITE_URL;
        const cleanOrigin = origin.replace(/\/$/, "").replace(/\/auth.*$/, "");
        // Garante que a URL de redirecionamento seja válida mesmo que cleanOrigin seja "*" ou malformado
        const baseHost    = (cleanOrigin && cleanOrigin !== "*") ? cleanOrigin : SITE_URL;
        const redirectTo  = `${baseHost.replace(/\/$/, "")}/reset-password`;

        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
          options: { redirectTo },
        });
        if (linkErr) throw linkErr;

        await auditLog("PASSWORD_RESET_LINK", null, { mode: "send_link", email: targetEmail });

        return new Response(
          JSON.stringify({
            success: true,
            mode: "send_link",
            message: "Link de redefinição enviado para o e-mail do usuário.",
            recovery_link: linkData?.properties?.action_link ?? null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tempPassword = generateTempPassword();
      const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, { password: tempPassword });
      if (updErr) throw updErr;

      await adminClient.from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", user_id);

      await auditLog("PASSWORD_RESET_TEMP", null, { mode: "temp_password", must_change_password: true });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "temp_password",
          ...(EXPOSE_TEMP_PWD ? { temp_password: tempPassword } : {}),
          message: EXPOSE_TEMP_PWD
            ? "Senha temporária gerada. Repasse ao usuário — ele será obrigado a trocá-la no próximo login."
            : "Senha temporária definida. O usuário será obrigado a trocá-la no próximo login.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[admin-user-management]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
