import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  readJsonBody,
  RequestBodyTooLargeError,
} from "../_shared/request-body.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

function keyFromJson(name: string, property: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw)?.[property];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

const ANON_KEY =
  keyFromJson("SUPABASE_PUBLISHABLE_KEYS", "anon") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";
const SERVICE_KEY =
  keyFromJson("SUPABASE_SECRET_KEYS", "service_role") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function passwordPolicyError(password: string): string | null {
  if (password.length < 12 || password.length > 128) return "PASSWORD_LENGTH_INVALID";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "PASSWORD_COMPLEXITY_INVALID";
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !SITE_URL) {
    return json({ error: "SERVER_MISCONFIGURED" }, 503);
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: "UNAUTHORIZED" }, 401);

    const { password } = await readJsonBody<{ password?: unknown }>(req, 2_048);
    if (typeof password !== "string") return json({ error: "PASSWORD_REQUIRED" }, 400);
    const policyError = passwordPolicyError(password);
    if (policyError) return json({ error: policyError }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("must_change_password")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (profileError) return json({ error: "PROFILE_LOOKUP_FAILED" }, 500);
    if (!profile?.must_change_password) return json({ error: "PASSWORD_CHANGE_NOT_REQUIRED" }, 409);

    const { error: passwordError } = await admin.auth.admin.updateUserById(auth.user.id, { password });
    if (passwordError) {
      const code = passwordError.code === "same_password" ? "SAME_PASSWORD" : "PASSWORD_UPDATE_FAILED";
      return json({ error: code }, passwordError.status && passwordError.status < 500 ? 400 : 502);
    }

    const { data: updatedProfiles, error: updateError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", auth.user.id)
      .eq("must_change_password", true)
      .select("user_id");
    if (updateError || updatedProfiles?.length !== 1) {
      // A senha já foi alterada, mas a flag permanece fechada. O usuário não
      // recebe acesso até a consistência do perfil ser restabelecida.
      return json({ error: "PASSWORD_UPDATED_PROFILE_PENDING" }, 500);
    }

    return json({ success: true }, 200);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "REQUEST_TOO_LARGE" }, 413);
    if (error instanceof SyntaxError) return json({ error: "INVALID_JSON" }, 400);
    console.error("[complete-password-change] unexpected error");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
