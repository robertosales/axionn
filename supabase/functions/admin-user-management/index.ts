import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Redeploy bump: 2026-07-06 — fix reset_password via admin-user-management

const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:8080";
const EXPOSE_TEMP_PWD = Deno.env.get("EXPOSE_TEMP_PASSWORD") !== "false";

const PUBLIC_SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") ?? (SITE_URL && SITE_URL !== "*" ? SITE_URL : "https://usesprintflow.lovable.app");

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "https://axionn.lovable.app",
  "https://usesprintflow.lovable.app",
];

function buildAllowedOrigins(): Set<string> {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return new Set(
      envOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }
  const defaults = new Set(DEFAULT_ALLOWED_ORIGINS);
  if (SITE_URL && SITE_URL !== "*") defaults.add(SITE_URL);
  if (PUBLIC_SITE_URL && PUBLIC_SITE_URL !== "*") defaults.add(PUBLIC_SITE_URL);
  return defaults;
}

function isLovableDomain(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return null;
  const allowed = buildAllowedOrigins();
  if (allowed.has(origin) || isLovableDomain(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-api-version, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  }
  return null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const _secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const _publishKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
let SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

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

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("[admin-user-management] Credenciais do Supabase ausentes na inicialização.");
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (!corsHeaders) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: "Origin não permitido" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "Credenciais do Supabase não configuradas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta ação" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, user_id, new_email, mode, email_mode, is_active } = body as {
      action: "change_email" | "reset_password" | "toggle_active";
      user_id: string;
      new_email?: string;
      mode?: "temp_password" | "send_link";
      email_mode?: "confirm" | "direct";
      is_active?: boolean;
    };

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action e user_id obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!UUID_REGEX.test(user_id)) {
      return new Response(JSON.stringify({ error: "user_id deve ser um UUID válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "Use as configurações de perfil para alterar seus próprios dados" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const auditLog = async (auditAction: string, payload: Record<string, unknown> = {}) => {
      try {
        const { error } = await adminClient
          .from("user_management_audit_log")
          .insert({ actor_id: caller.id, target_id: user_id, action: auditAction, payload });
        if (error) console.error("[admin-user-management] Erro Auditoria:", error.message);
      } catch (e) {
        console.error("[admin-user-management] Falha na auditoria (best-effort):", e);
      }
    };

    if (action === "change_email") {
      if (!new_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
        return new Response(JSON.stringify({ error: "E-mail inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: currentProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();

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

      await auditLog("change_email", {
        old_email: currentProfile?.email ?? null,
        new_email,
        mode: isDirect ? "direct" : "confirm",
      });

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

    if (action === "reset_password") {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      const targetEmail = profile?.email;

      if (mode === "send_link") {
        if (!targetEmail) {
          return new Response(JSON.stringify({ error: "Usuário sem e-mail cadastrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const rawOrigin = req.headers.get("origin") ?? req.headers.get("referer") ?? PUBLIC_SITE_URL;
        let cleanOrigin = PUBLIC_SITE_URL;
        try {
          const u = new URL(rawOrigin);
          cleanOrigin = `${u.protocol}//${u.host}`;
        } catch {
          cleanOrigin = PUBLIC_SITE_URL;
        }

        const { error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
          options: { redirectTo: `${cleanOrigin}/reset-password` },
        });
        if (linkErr) throw linkErr;

        await auditLog("reset_password", { mode: "send_link", email: targetEmail });

        return new Response(
          JSON.stringify({
            success: true,
            mode: "send_link",
            message: "Link de redefinição enviado para o e-mail do usuário.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // mode: "temp_password" (default)
      const tempPassword = generateTempPassword();
      const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, { password: tempPassword });
      if (updErr) throw updErr;

      await adminClient.from("profiles").update({ must_change_password: true }).eq("user_id", user_id);
      await auditLog("reset_password", { mode: "temp_password", must_change_password: true });

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
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[admin-user-management]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
