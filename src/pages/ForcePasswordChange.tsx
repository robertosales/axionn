import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_MIN_LENGTH, passwordPolicyError } from "@/lib/passwordPolicy";
import { checkAuthRateLimit } from "@/lib/authRateLimiter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function ForcePasswordChange(_props: { onDone: () => void }) {
  const { signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ redirectIn: number } | null>(null);
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
    const policyError = passwordPolicyError(password);
    if (policyError) {
      const m = policyError;
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
    const rateLimit = await checkAuthRateLimit("reset_password");
    if (!rateLimit.allowed) {
      const message = rateLimit.retryAfter
        ? `Muitas tentativas. Aguarde ${rateLimit.retryAfter}s.`
        : "Muitas tentativas. Aguarde alguns instantes.";
      setErrorMsg(message);
      toast.error(message);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    const { error } = await supabase.functions.invoke("complete-password-change", {
      body: { password },
    });
    if (error) {
      const message = "Não foi possível concluir a troca de senha com segurança. Tente novamente.";
      setErrorMsg(message);
      toast.error(message);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    setPassword("");
    setConfirm("");
    toast.success("Senha atualizada com sucesso!");
    setLoading(false);
    setSuccess({ redirectIn: 5 });
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
                  minLength={PASSWORD_MIN_LENGTH}
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
                  minLength={PASSWORD_MIN_LENGTH}
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
