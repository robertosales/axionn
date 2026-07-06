import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/constants";
import { checkAuthRateLimit } from "@/lib/authRateLimiter";
import { AxionLogo } from "@/components/AxionLogo";

type RecoveryStatus = "validating" | "ready" | "invalid" | "resent";

const VALIDATION_TIMEOUT_MS = 8_000;

function recoveryErrorMessage(code: string | null, description: string | null) {
  if (code === "otp_expired" || /expired/i.test(description ?? "")) {
    return "Este link de redefinição expirou ou já foi utilizado. Solicite um novo link abaixo.";
  }

  if (code === "access_denied") {
    return "Este link de redefinição não é mais válido. Solicite um novo link abaixo.";
  }

  return "Não foi possível validar este link de redefinição. Solicite um novo link abaixo.";
}

function cleanRecoveryUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const validationFinished = useRef(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("validating");
  const [recoveryError, setRecoveryError] = useState("");

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const markReady = () => {
      if (!active || validationFinished.current) return;
      validationFinished.current = true;
      if (timeoutId) clearTimeout(timeoutId);
      setRecoveryError("");
      setStatus("ready");
      cleanRecoveryUrl();
    };

    const markInvalid = (message: string) => {
      if (!active || validationFinished.current) return;
      validationFinished.current = true;
      if (timeoutId) clearTimeout(timeoutId);
      setRecoveryError(message);
      setStatus("invalid");
      cleanRecoveryUrl();
    };

    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const searchParams = new URLSearchParams(window.location.search);
    const errorCode =
      hashParams.get("error_code") ??
      searchParams.get("error_code") ??
      hashParams.get("error") ??
      searchParams.get("error");
    const errorDescription =
      hashParams.get("error_description") ??
      searchParams.get("error_description");

    if (errorCode) {
      markInvalid(recoveryErrorMessage(errorCode, errorDescription));
      return () => {
        active = false;
      };
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    async function validateRecovery() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          markReady();
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            markInvalid(recoveryErrorMessage(error.code ?? null, error.message));
            return;
          }
          markReady();
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            markInvalid(recoveryErrorMessage(error.code ?? null, error.message));
            return;
          }
          markReady();
          return;
        }

        timeoutId = setTimeout(() => {
          markInvalid(
            "Não foi possível criar uma sessão de recuperação. O link pode ter expirado ou já ter sido utilizado.",
          );
        }, VALIDATION_TIMEOUT_MS);
      } catch (error) {
        const message = error instanceof Error ? error.message : null;
        markInvalid(recoveryErrorMessage(null, message));
      }
    }

    void validateRecovery();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const { allowed, retryAfter } = await checkAuthRateLimit("reset_password");
    if (!allowed) {
      toast.error(
        retryAfter
          ? `Muitas tentativas de redefinição. Aguarde ${retryAfter}s.`
          : "Muitas tentativas. Tente novamente em instantes.",
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const code = error.code || "";
      const message = error.message || "";
      let friendly = message;

      if (code === "same_password" || /should be different from the old/i.test(message)) {
        friendly = "A nova senha deve ser diferente da senha atual.";
      } else if (code === "weak_password" || /weak|pwned|leaked/i.test(message)) {
        friendly = "Senha muito fraca ou exposta em vazamentos. Use uma senha mais forte.";
      } else if (/at least.*characters/i.test(message)) {
        friendly = "A senha não atende ao tamanho mínimo exigido.";
      } else if (/session|not authenticated|JWT/i.test(message)) {
        friendly = "A sessão de recuperação expirou. Solicite um novo link.";
        validationFinished.current = false;
        setRecoveryError(friendly);
        setStatus("invalid");
      }

      toast.error(friendly);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", userData.user.id);
    }

    toast.success("Senha redefinida com sucesso!");
    setLoading(false);
    navigate("/", { replace: true });
  };

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe o e-mail da conta");
      return;
    }

    setLoading(true);
    const { allowed, retryAfter } = await checkAuthRateLimit("reset_password");
    if (!allowed) {
      toast.error(
        retryAfter
          ? `Muitas solicitações. Aguarde ${retryAfter}s para tentar novamente.`
          : "Muitas solicitações. Tente novamente em instantes.",
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar outro link. Tente novamente.");
      return;
    }

    setStatus("resent");
    toast.success("Novo link solicitado");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg">
        <CardHeader className="space-y-3 px-8 pb-2 pt-8 text-center">
          <div className="flex justify-center">
            <AxionLogo size={56} />
          </div>
          <CardTitle className="text-2xl font-bold">{APP_NAME}</CardTitle>
          <CardDescription>Definir nova senha</CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-4">
          {status === "validating" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Validando link de recuperação...
              </p>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-xl pl-9 pr-10"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar nova senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="h-11 rounded-xl pl-9 pr-10"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}

          {status === "invalid" && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Link expirado ou inválido</p>
                  <p className="mt-1 text-sm leading-5">{recoveryError}</p>
                </div>
              </div>

              <form onSubmit={handleResend} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recovery-email">E-mail da conta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="recovery-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="seu@email.com"
                      className="h-11 rounded-xl pl-9"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar novo link"}
                </Button>
              </form>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth", { replace: true })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </div>
          )}

          {status === "resent" && (
            <div className="space-y-5 text-center">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-800">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <p className="font-semibold">Novo link enviado</p>
                  <p className="mt-1 text-sm leading-5">
                    Enviamos outra solicitação para <strong>{email}</strong>. Use somente o e-mail mais recente e confira também a caixa de spam.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/auth", { replace: true })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
