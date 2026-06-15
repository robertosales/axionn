import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
import { Mail, Lock, Clock, Eye, EyeOff, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { APP_TAGLINE } from "@/lib/constants";
import { AxionLogo } from "@/components/AxionLogo";
import { checkAuthRateLimit } from "@/lib/authRateLimiter";

// ---------------------------------------------------------------------------
// STYLE GUIDE — Auth (login + signup)
// Paleta:  Teal principal #0d9488  |  Verde logo #1f9a52  |  Cinza fundo #f8fafc
// Inputs:  rounded-xl  h-11  pl-10  border-border
// Botao primario: bg-primary rounded-xl h-11 font-semibold
// Card:    max-w-md  rounded-2xl  shadow-lg  p-8
// UX corporativo:
//   - autocomplete correto para gestores de senha
//   - type="email" correto para teclados mobile
//   - aria-label nos icones decorativos
//   - Unico CTA principal por tela
//   - Link de alternancia discreto no rodape
// ---------------------------------------------------------------------------

type AuthMode = "login" | "signup";

const Auth = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const idleTimeout = searchParams.get("reason") === "idle_timeout";
  const initialMode: AuthMode =
    searchParams.get("tab") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Campos compartilhados
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Campos exclusivos do signup
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Toggle visibilidade de senha
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Alternância de modo ──────────────────────────────────────────────────
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setSearchParams(next === "signup" ? { tab: "signup" } : {}, { replace: true });
    // Limpa campos sensíveis ao trocar de modo
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);
    const { allowed, retryAfter } = await checkAuthRateLimit("login");
    if (!allowed) {
      toast.error(
        retryAfter
          ? `Muitas tentativas de login. Aguarde ${retryAfter}s antes de tentar novamente.`
          : "Muitas tentativas de login. Tente novamente em instantes.",
      );
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else toast.success("Login realizado com sucesso!");
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!email) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    const { allowed, retryAfter } = await checkAuthRateLimit("signup");
    if (!allowed) {
      toast.error(
        retryAfter
          ? `Muitas tentativas de cadastro. Aguarde ${retryAfter}s antes de tentar novamente.`
          : "Muitas tentativas de cadastro. Tente novamente em instantes.",
      );
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        "Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.",
        { duration: 6000 },
      );
      // Redireciona para login após signup bem-sucedido
      switchMode("login");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      toast.error("Erro ao fazer login com Google");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error(
        "Informe seu e-mail no campo acima para receber o link de redefinição",
      );
      return;
    }
    setLoading(true);
    const { allowed, retryAfter } = await checkAuthRateLimit("reset_password");
    if (!allowed) {
      toast.error(
        retryAfter
          ? `Muitas solicitações de redefinição. Aguarde ${retryAfter}s.`
          : "Muitas solicitações. Tente novamente em instantes.",
      );
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else
      toast.success(
        "Enviamos um link de redefinição para o seu e-mail (verifique também o spam).",
      );
    setLoading(false);
  };

  // ── UI ───────────────────────────────────────────────────────────────────

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg">
        {/* Cabeçalho */}
        <CardHeader className="text-center space-y-3 pb-2 pt-8 px-8">
          <div className="flex justify-center">
            <AxionLogo size={56} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Axi<span className="text-[#1f9a52]">o</span>n
          </CardTitle>
          <CardDescription className="text-sm">
            {isSignup ? "Crie sua conta para começar" : APP_TAGLINE}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-4 space-y-5">
          {/* Aviso de sessão expirada por inatividade — só no login */}
          {!isSignup && idleTimeout && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3">
              <Clock
                className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-700">
                Sua sessão foi encerrada por{" "}
                <strong>inatividade</strong>. Faça login para continuar.
              </p>
            </div>
          )}

          {/* OAuth Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl font-medium"
            onClick={handleGoogleLogin}
            disabled={loading}
            aria-label={isSignup ? "Cadastrar com Google" : "Entrar com Google"}
          >
            <svg
              className="h-4 w-4 mr-2 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isSignup ? "Cadastrar com Google" : "Entrar com Google"}
          </Button>

          {/* Divisor */}
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground select-none">
              {isSignup ? "ou cadastre-se com e-mail" : "ou entre com e-mail"}
            </span>
          </div>

          {/* ── FORMULÁRIO DE SIGNUP ─────────────────────────────────────── */}
          {isSignup ? (
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              {/* Nome completo */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-name" className="text-sm font-medium">
                  Nome completo{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="João da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 h-11 rounded-xl"
                    autoComplete="name"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-sm font-medium">
                  E-mail{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 rounded-xl"
                    autoComplete="email"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-sm font-medium">
                  Senha{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-11 rounded-xl"
                    autoComplete="new-password"
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground pl-1">
                  Use pelo menos 6 caracteres
                </p>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="signup-confirm-password"
                  className="text-sm font-medium"
                >
                  Confirmar senha{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9 pr-10 h-11 rounded-xl"
                    autoComplete="new-password"
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={
                      showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* CTA principal */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-sm"
                disabled={loading}
              >
                {loading ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          ) : (
            /* ── FORMULÁRIO DE LOGIN ───────────────────────────────────── */
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-medium">
                  E-mail{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 rounded-xl"
                    autoComplete="email"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-medium">
                  Senha{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-11 rounded-xl"
                    autoComplete="current-password"
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* CTA principal */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-sm"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              {/* Link esqueci senha */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                  disabled={loading}
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          )}

          {/* Alternância de modo — rodapé discreto */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            {isSignup ? (
              <>
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-primary font-medium hover:underline transition-colors"
                  disabled={loading}
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-primary font-medium hover:underline transition-colors"
                  disabled={loading}
                >
                  Cadastre-se
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
