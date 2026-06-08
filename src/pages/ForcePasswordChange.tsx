import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react";

type AuthCallWindow = Window & { __authUserCallCount?: number };

export default function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ calls: number; redirectIn: number } | null>(null);

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
    setErrorMsg(null);
    if (password.length < 6) {
      const m = "A senha deve ter ao menos 6 caracteres";
      setErrorMsg(m); toast.error(m);
      return;
    }
    if (password !== confirm) {
      const m = "As senhas não coincidem";
      setErrorMsg(m); toast.error(m);
      return;
    }
    setLoading(true);

    // Zera contador de chamadas /auth/v1/user para medir SOMENTE esta ação.
    const w = window as AuthCallWindow;
    w.__authUserCallCount = 0;

    // Pausa auto-refresh durante a operação crítica para evitar disputa pelo
    // Web Lock de auth enquanto o PUT /auth/v1/user ainda está em andamento.
    await supabase.auth.stopAutoRefresh();

    let updData: { user?: { id?: string } | null } | null = null;
    let error: unknown = null;
    try {
      // Chama updateUser DIRETO — não fazer getSession() antes para evitar
      // contenção no lock interno do GoTrue (`sb-...-auth-token`).
      const result = await supabase.auth.updateUser({ password });
      updData = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
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
      await supabase.auth.startAutoRefresh();
      return;
    }

    // Limpa a flag must_change_password
    const uid = updData?.user?.id ?? user?.id;
    if (uid) {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", uid);
      if (profErr) {
        console.error("[ForcePasswordChange] profiles update falhou:", profErr);
        toast.error(
          "Senha trocada, mas não foi possível liberar o acesso automaticamente. Faça login novamente.",
        );
        setLoading(false);
        await signOut();
        return;
      }
    }

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