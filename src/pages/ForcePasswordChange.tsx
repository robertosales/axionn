import { useEffect, useRef, useState } from "react";
// Fluxo de troca obrigatória de senha: a flag profiles.must_change_password é
// baixada ANTES do PUT /auth/v1/user (que invalida a sessão e impede o UPDATE).
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react";

type AuthCallWindow = Window & { __authUserCallCount?: number };
const AUTH_USER_URL = "https://rgikyyazotqapaxijwui.supabase.co/auth/v1/user";
const AUTH_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg";

export default function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const { session, user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ calls: number; redirectIn: number } | null>(null);
  const submittingRef = useRef(false);

  // Após sucesso, faz logout e retorna à tela de login automaticamente em 5s.
  useEffect(() => {
    if (!success) return;
    if (success.redirectIn <= 0) {
      signOut();
      return;
    }
    const t = setTimeout(
      () => setSuccess((s) => (s ? { ...s, redirectIn: s.redirectIn - 1 } : s)),
      1000,
    );
    return () => clearTimeout(t);
  }, [success, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMsg(null);
    if (password.length < 6) {
      const m = "A senha deve ter ao menos 6 caracteres";
      setErrorMsg(m); toast.error(m);
      submittingRef.current = false;
      return;
    }
    if (password !== confirm) {
      const m = "As senhas não coincidem";
      setErrorMsg(m); toast.error(m);
      submittingRef.current = false;
      return;
    }
    setLoading(true);

    // Zera contador de chamadas /auth/v1/user para medir SOMENTE esta ação.
    const w = window as AuthCallWindow;
    w.__authUserCallCount = 0;

    // PASSO 1 — Baixar a flag must_change_password ANTES do PUT /auth/v1/user.
    // Motivo: o PUT /user invalida todas as sessões existentes do usuário no
    // GoTrue. Logo após, o auto-refresh interno do supabase-js percebe
    // `session_not_found` e zera o JWT local; qualquer UPDATE posterior em
    // `profiles` segue sem auth.uid(), a RLS bloqueia silenciosamente
    // (0 linhas, sem erro) e a flag permanece true — o usuário volta para
    // esta mesma tela no próximo login.
    const uid = user?.id;
    if (!uid) {
      const m = "Sessão expirada. Faça login novamente para trocar a senha.";
      setErrorMsg(m); toast.error(m);
      setLoading(false);
      submittingRef.current = false;
      await signOut();
      return;
    }

    const { data: flagRows, error: flagErr } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", uid)
      .select("user_id");

    if (flagErr || !flagRows || flagRows.length === 0) {
      console.error("[ForcePasswordChange] update flag falhou:", { flagErr, rows: flagRows?.length });
      const m = flagErr?.message
        ? `Não foi possível liberar o acesso: ${flagErr.message}`
        : "Sessão expirada ou sem permissão para liberar o acesso. Faça login novamente.";
      setErrorMsg(m); toast.error(m);
      setLoading(false);
      submittingRef.current = false;
      await signOut();
      return;
    }

    // PASSO 2 — Chamada direta e única ao endpoint de troca de senha.
    // Não usa supabase.auth.updateUser(), portanto não entra no Web Lock
    // `lock:sb-...-auth-token` que vinha sendo roubado durante requisições lentas.
    let updData: { user?: { id?: string } | null } | null = null;
    let error: unknown = null;
    try {
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente para trocar a senha.");

      w.__authUserCallCount = (w.__authUserCallCount ?? 0) + 1;
      const response = await fetch(AUTH_USER_URL, {
        method: "PUT",
        headers: {
          apikey: AUTH_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw {
          code: payload?.code || payload?.error_code,
          status: response.status,
          message: payload?.msg || payload?.message || payload?.error_description || "Não foi possível atualizar a senha.",
        };
      }
      updData = payload;
    } catch (err) {
      error = err;
    }

    if (error) {
      // ROLLBACK — restaura must_change_password=true para manter o estado
      // consistente, já que o GoTrue rejeitou a nova senha.
      try {
        await supabase
          .from("profiles")
          .update({ must_change_password: true })
          .eq("user_id", uid);
      } catch (rbErr) {
        console.error("[ForcePasswordChange] rollback flag falhou:", rbErr);
      }

      const anyErr = error as any;
      const code = anyErr.code || anyErr.error_code || "";
      const status = anyErr.status || anyErr.statusCode || "";
      const msg = anyErr.message || "";
      // Log seguro para diagnóstico
      console.error("[ForcePasswordChange] updateUser falhou:", { code, status, msg });

      let friendly = msg;
      if (/Lock .*auth-token.*released because another request stole it/i.test(msg)) {
        friendly = "A rotina de autenticação estava ocupada. Aguarde alguns segundos e tente novamente.";
      } else if (code === "same_password" || /should be different from the old|same.*password/i.test(msg)) {
        friendly = "A nova senha deve ser diferente da senha atual. Escolha outra.";
      } else if (
        code === "weak_password" ||
        /weak|pwned|leaked|compromised|breached|been found/i.test(msg)
      ) {
        friendly =
          "Esta senha foi identificada em vazamentos públicos ou é muito fraca. Use uma senha forte (letras maiúsculas, minúsculas, números e símbolos).";
      } else if (/at least.*characters|minimum.*length|too short/i.test(msg)) {
        friendly = "A senha não atende ao tamanho mínimo exigido (mín. 6 caracteres).";
      } else if (/should contain|must contain|requires/i.test(msg)) {
        friendly = "A senha não atende aos requisitos de complexidade exigidos pelo sistema.";
      } else if (status === 401 || status === 403 || /jwt|session|not authenticated/i.test(msg)) {
        friendly = "Sessão expirada. Faça login novamente para trocar a senha.";
      } else if (status === 429) {
        friendly = "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
      } else if (!friendly) {
        friendly = "Não foi possível atualizar a senha. Tente novamente.";
      }
      setErrorMsg(friendly);
      toast.error(friendly);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    // Flag já foi baixada no PASSO 1 (e validada via .select()).
    void updData;
    const calls = (window as AuthCallWindow).__authUserCallCount ?? 0;
    console.info(`[ForcePasswordChange] OK — chamadas /auth/v1/user: ${calls}`);
    toast.success(`Senha atualizada com sucesso! (${calls} chamada${calls === 1 ? "" : "s"} ao auth)`);
    setLoading(false);
    setSuccess({ calls, redirectIn: 5 });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-emerald-300">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold">Senha atualizada com sucesso</CardTitle>
            <CardDescription>
              Sua nova senha já está ativa. Você será redirecionado à tela de login em{" "}
              <strong>{success.redirectIn}s</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <p className="font-semibold">Diagnóstico desta operação</p>
              <p>
                Chamadas a <code>/auth/v1/user</code>:{" "}
                <strong>{success.calls}</strong>{" "}
                {success.calls === 1
                  ? "✓ (esperado: 1 — sem retry/lock contention)"
                  : success.calls === 0
                    ? "⚠ (contador não registrou — verifique fetch wrapper)"
                    : "⚠ (mais de 1 — possível duplicação)"}
              </p>
            </div>
            <Button className="w-full" onClick={signOut}>
              Ir para login agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-amber-300">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold">Troca de senha obrigatória</CardTitle>
          <CardDescription>
            Sua senha foi redefinida pelo administrador. Defina uma nova senha pessoal para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fpc-pwd">Nova senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fpc-pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fpc-confirm">Confirmar nova senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fpc-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Definir nova senha"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={signOut} disabled={loading}>
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}