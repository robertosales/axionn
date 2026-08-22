import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkAuthRateLimit } from "@/lib/authRateLimiter";
import { useAuth } from "@/contexts/AuthContext";
import { AxionLogo } from "@/components/AxionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function BackofficeMfaGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel === "aal2") {
        setVerified(true);
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const existing = factors.data.totp[0];
      if (existing) {
        setFactorId(existing.id);
        return;
      }

      // Um fator não verificado não possui mais o segredo/QR necessário para
      // concluir o cadastro após recarregar a página. Removemos apenas esses
      // fatores incompletos antes de iniciar um novo enrolamento.
      for (const pending of factors.data.all.filter(
        (factor) => factor.factor_type === "totp" && factor.status === "unverified",
      )) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: pending.id });
        if (removed.error) throw removed.error;
      }

      const enrolled = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Axionn Backoffice",
        issuer: "Axionn",
      });
      if (enrolled.error) throw enrolled.error;
      setFactorId(enrolled.data.id);
      setEnrollment({
        factorId: enrolled.data.id,
        qrCode: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
    } catch {
      setError("Não foi possível preparar a autenticação em duas etapas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const verify = async (candidateCode = code) => {
    if (!factorId || candidateCode.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    const limit = await checkAuthRateLimit("otp");
    if (!limit.allowed) {
      setError(limit.retryAfter
        ? `Muitas tentativas. Aguarde ${limit.retryAfter}s.`
        : "Muitas tentativas. Aguarde alguns instantes.");
      setSubmitting(false);
      return;
    }

    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code: candidateCode });
    if (result.error) {
      setCode("");
      setError("Código inválido ou expirado. Gere um novo código no autenticador.");
      setSubmitting(false);
      return;
    }

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      setError("Não foi possível confirmar o segundo fator.");
      setSubmitting(false);
      return;
    }
    setVerified(true);
    setSubmitting(false);
  };

  if (verified) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center gap-2">
            <AxionLogo size={36} />
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Verificação obrigatória do backoffice</CardTitle>
          <CardDescription>
            Confirme um código TOTP para acessar dados administrativos e financeiros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Preparando segundo fator...</p>
            </div>
          ) : (
            <>
              {enrollment && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-sm font-medium">1. Escaneie no seu aplicativo autenticador</p>
                  <img
                    src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.qrCode)}`}
                    alt="QR Code para configurar autenticação em duas etapas"
                    className="mx-auto h-44 w-44 rounded-md bg-white p-2"
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Ou informe esta chave manualmente:</p>
                    <code className="mt-1 block break-all rounded bg-background px-2 py-1 text-xs">
                      {enrollment.secret}
                    </code>
                  </div>
                </div>
              )}

              <div className="space-y-3 text-center">
                <p className="text-sm font-medium">
                  {enrollment ? "2. Digite o código de 6 dígitos" : "Digite o código do seu autenticador"}
                </p>
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => setCode(value.replace(/\D/g, ""))}
                  onComplete={(value) => void verify(String(value))}
                  disabled={submitting}
                  aria-label="Código de autenticação em duas etapas"
                >
                  <InputOTPGroup className="mx-auto">
                    {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}
                  </InputOTPGroup>
                </InputOTP>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" onClick={() => void verify()} disabled={code.length !== 6 || submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Verificar e acessar
                </Button>
                {error && (
                  <Button variant="outline" className="w-full" onClick={() => void initialize()}>
                    Tentar preparar novamente
                  </Button>
                )}
              </div>
            </>
          )}
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
