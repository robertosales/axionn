// src/pages/AuthCallback.tsx
// Processa o retorno do OAuth do Lovable SDK.
// O Lovable SDK redireciona com tokens no hash: #access_token=...&refresh_token=...
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AxionLogo } from "@/components/AxionLogo";

export default function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handleCallback() {
      try {
        // --- Caso 1: tokens no hash (Lovable SDK implicit flow) ---
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              console.error("[AuthCallback] setSession error:", error);
              navigate("/auth?error=set_session_failed", { replace: true });
              return;
            }
            navigate("/", { replace: true });
            return;
          }
        }

        // --- Caso 2: PKCE code no query string ---
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[AuthCallback] exchangeCodeForSession error:", error);
            navigate("/auth?error=pkce_failed", { replace: true });
            return;
          }
          navigate("/", { replace: true });
          return;
        }

        // --- Caso 3: sessão já existe ---
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/", { replace: true });
          return;
        }

        console.warn("[AuthCallback] nenhum token encontrado na URL de callback");
        console.warn("hash:", window.location.hash);
        console.warn("search:", window.location.search);
        navigate("/auth?error=no_token", { replace: true });
      } catch (err) {
        console.error("[AuthCallback] erro inesperado:", err);
        navigate("/auth?error=unexpected", { replace: true });
      }
    }

    void handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <AxionLogo size={48} />
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Finalizando autenticação...</p>
      </div>
    </div>
  );
}
