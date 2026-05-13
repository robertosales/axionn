// src/pages/AuthCallback.tsx
// Página de callback OAuth — processa o code retornado pelo provider (Google etc.)
// e troca por sessão válida via Supabase PKCE antes de redirecionar o usuário.
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
        // Caso PKCE: URL contém ?code=...
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[AuthCallback] exchangeCodeForSession error:", error);
            navigate("/auth?error=oauth_failed", { replace: true });
            return;
          }
        }

        // Caso implicit flow: URL contém #access_token=...
        // O SDK do Supabase detecta automaticamente via onAuthStateChange,
        // mas forçamos getSession para garantir sincronização.
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Redireciona para a raiz — o ModuleRedirect cuida de onde enviar
          navigate("/", { replace: true });
        } else {
          // Sem sessão após callback — algo deu errado
          navigate("/auth?error=no_session", { replace: true });
        }
      } catch (err) {
        console.error("[AuthCallback] unexpected error:", err);
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
