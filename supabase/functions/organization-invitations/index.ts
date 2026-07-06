import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLIC_SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") ??
  Deno.env.get("SITE_URL") ??
  "https://axionn.lovable.app";
const EXPOSE_INVITE_LINKS = Deno.env.get("EXPOSE_ORGANIZATION_INVITE_LINKS") === "true";

let SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

if (secretKeys) {
  try {
    SERVICE_KEY = JSON.parse(secretKeys).service_role ?? SERVICE_KEY;
  } catch (error) {
    console.error("[organization-invitations] Invalid SUPABASE_SECRET_KEYS", error);
  }
}

if (publishableKeys) {
  try {
    ANON_KEY = JSON.parse(publishableKeys).anon ?? ANON_KEY;
  } catch (error) {
    console.error("[organization-invitations] Invalid SUPABASE_PUBLISHABLE_KEYS", error);
  }
}

if (!SERVICE_KEY || !ANON_KEY) {
  throw new Error("Supabase service and anon credentials are required.");
}

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "http://localhost:3000",
  "https://axionn.lovable.app",
  "https://usesprintflow.lovable.app",
]);

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".lovable.app") ||
        url.hostname.endsWith(".lovableproject.com"))
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  origin: string,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function resolveSiteOrigin(requestOrigin: string) {
  try {
    const url = new URL(requestOrigin);
    if (isAllowedOrigin(url.origin)) return url.origin;
  } catch {
    // Fall through to configured URL.
  }

  return new URL(PUBLIC_SITE_URL).origin;
}

function isExistingUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists")
  );
}

async function deliverInvitation(options: {
  email: string;
  invitationId: string;
  organizationId: string;
  rawToken: string;
  requestOrigin: string;
}) {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY!);
  const anonClient = createClient(SUPABASE_URL, ANON_KEY!);
  const siteOrigin = resolveSiteOrigin(options.requestOrigin);
  const inviteUrl = `${siteOrigin}/accept-invitation?token=${encodeURIComponent(options.rawToken)}`;

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    options.email,
    {
      redirectTo: inviteUrl,
      data: {
        organization_id: options.organizationId,
        organization_invitation_id: options.invitationId,
      },
    },
  );

  if (!inviteError) {
    return { delivered: true, deliveryMode: "auth_invite", inviteUrl };
  }

  if (!isExistingUserError(inviteError.message)) {
    throw inviteError;
  }

  const { error: otpError } = await anonClient.auth.signInWithOtp({
    email: options.email,
    options: {
      emailRedirectTo: inviteUrl,
      shouldCreateUser: false,
    },
  });

  if (otpError) throw otpError;

  return { delivered: true, deliveryMode: "magic_link", inviteUrl };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin!) });
  }

  if (request.method !== "POST") {
    return jsonResponse(origin!, { error: "Method not allowed" }, 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(origin!, { error: "Authentication required" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY!);

  const {
    data: { user: caller },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !caller) {
    return jsonResponse(origin!, { error: "Invalid authentication token" }, 401);
  }

  try {
    const payload = (await request.json()) as {
      action?: "create" | "resend";
      organization_id?: string;
      invitation_id?: string;
      email?: string;
      role?: "admin" | "member";
      module_keys?: string[];
    };

    let row: Record<string, unknown> | null = null;

    if (payload.action === "create") {
      if (!payload.organization_id || !payload.email || !payload.role) {
        return jsonResponse(
          origin!,
          { error: "organization_id, email and role are required" },
          400,
        );
      }

      const { data, error } = await adminClient.rpc(
        "create_organization_invitation",
        {
          p_org_id: payload.organization_id,
          p_email: payload.email,
          p_role: payload.role,
          p_module_keys: payload.module_keys ?? [],
          p_invited_by: caller.id,
        },
      );

      if (error) throw error;
      row = Array.isArray(data) ? data[0] : data;
    } else if (payload.action === "resend") {
      if (!payload.invitation_id) {
        return jsonResponse(origin!, { error: "invitation_id is required" }, 400);
      }

      const { data, error } = await adminClient.rpc(
        "resend_organization_invitation",
        {
          p_invitation_id: payload.invitation_id,
          p_actor_id: caller.id,
        },
      );

      if (error) throw error;
      row = Array.isArray(data) ? data[0] : data;
    } else {
      return jsonResponse(origin!, { error: "Unknown action" }, 400);
    }

    if (!row?.raw_token || !row?.normalized_email || !row?.invitation_id) {
      throw new Error("Invitation operation did not return delivery data.");
    }

    const organizationId = String(
      row.org_id ?? payload.organization_id ?? "",
    );

    const delivery = await deliverInvitation({
      email: String(row.normalized_email),
      invitationId: String(row.invitation_id),
      organizationId,
      rawToken: String(row.raw_token),
      requestOrigin: origin!,
    });

    return jsonResponse(origin!, {
      success: true,
      invitation_id: row.invitation_id,
      email: row.normalized_email,
      expires_at: row.expires_at,
      delivery_mode: delivery.deliveryMode,
      ...(EXPOSE_INVITE_LINKS ? { invite_url: delivery.inviteUrl } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[organization-invitations]", message);
    return jsonResponse(origin!, { error: message }, 500);
  }
});
