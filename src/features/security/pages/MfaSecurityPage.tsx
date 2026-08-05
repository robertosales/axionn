import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Copy, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMfaStatus } from "@/features/security/hooks/useMfaStatus";
import { AxionLogo } from "@/components/AxionLogo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Enrollment = { factorId: string; qrCode: string; secret: string };

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/modulos";
  return value;
}

function OtpField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
      <InputOTP id="mfa-code" maxLength={6} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" value={value} onChange={onChange} disabled={disabled} aria-describedby="mfa-code-help">
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />)}
        </InputOTPGroup>
      </InputOTP>
      <p id="mfa-code-help" className="text-xs text-muted-foreground">Digite o código atual exibido pelo aplicativo autenticador.</p>
    </div>
  );
}

export default function MfaSecurityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const required = searchParams.get("required") === "true";
  const nextPath = safeNextPath(searchParams.get("next"));
  const { currentLevel, verifiedFactors, loading, error, refresh } = useMfaStatus();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const beginEnrollment = useCallback(async () => {
    setSubmitting(true);
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      toast.error("Não foi possível iniciar a configuração do autenticador.");
      setSubmitting(false);
      return;
    }

    const staleFactors = factors.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
    await Promise.all(staleFactors.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));

    const result = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Axionn ${new Date().toLocaleDateString("pt-BR")}`,
    });

    if (result.error) {
      toast.error("Não foi possível gerar o QR Code. Tente novamente.");
    } else {
      setEnrollment({ factorId: result.data.id, qrCode: result.data.totp.qr_code, secret: result.data.totp.secret });
      setCode("");
    }
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!loading && verifiedFactors.length === 0 && !enrollment) void beginEnrollment();
  }, [beginEnrollment, enrollment, loading, verifiedFactors.length]);

  const verify = async () => {
    const factorId = enrollment?.factorId ?? verifiedFactors[0]?.id;
    if (!factorId || code.length !== 6) return;
    setSubmitting(true);
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      toast.error("Código inválido ou expirado. Confira o autenticador e tente novamente.");
      setCode("");
      setSubmitting(false);
      return;
    }
    await refresh();
    setEnrollment(null);
    setCode("");
    setSubmitting(false);
    toast.success("Proteção em duas etapas confirmada.");
    navigate(nextPath, { replace: true });
  };

  const copySecret = async () => {
    if (!enrollment?.secret) return;
    await navigator.clipboard.writeText(enrollment.secret);
    toast.success("Chave copiada. Mantenha-a em local seguro.");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Carregando proteção em duas etapas" /></div>;
  }

  const needsChallenge = verifiedFactors.length > 0 && currentLevel !== "aal2";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <div className="flex items-center justify-center gap-3"><AxionLogo size={40} /><div><p className="font-semibold">Axionn</p><p className="text-xs text-muted-foreground">Central de segurança</p></div></div>
        {required && <Alert><LockKeyhole className="h-4 w-4" /><AlertTitle>Verificação obrigatória</AlertTitle><AlertDescription>O Backoffice contém dados administrativos e financeiros. Confirme o segundo fator para continuar.</AlertDescription></Alert>}
        {error && <Alert variant="destructive" role="alert"><AlertTitle>Consulta indisponível</AlertTitle><AlertDescription>{error} Atualize a página e tente novamente.</AlertDescription></Alert>}

        <Card className="shadow-sm">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><Badge variant={currentLevel === "aal2" ? "default" : "secondary"}>{currentLevel === "aal2" ? "Sessão protegida" : "Verificação pendente"}</Badge></div>
            <CardTitle>Proteção em duas etapas</CardTitle>
            <CardDescription>Use Microsoft Authenticator, Google Authenticator, 1Password ou outro aplicativo compatível com TOTP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {enrollment ? (
              <>
                <div className="space-y-3 text-center">
                  <p className="text-sm font-medium">1. Escaneie o QR Code</p>
                  <div className="mx-auto w-fit rounded-xl border bg-white p-3"><img src={enrollment.qrCode} alt="QR Code para cadastrar o Axionn no aplicativo autenticador" className="h-48 w-48" /></div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-left"><p className="mb-2 text-xs text-muted-foreground">Não consegue escanear? Use a chave manual:</p><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs" aria-label="Chave de configuração manual">{enrollment.secret}</code><Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={copySecret} aria-label="Copiar chave de configuração"><Copy className="h-4 w-4" /></Button></div></div>
                </div>
                <div className="space-y-3"><p className="text-sm font-medium">2. Confirme o código gerado</p><OtpField value={code} onChange={setCode} disabled={submitting} /></div>
              </>
            ) : needsChallenge ? (
              <div className="space-y-4"><div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"><KeyRound className="mt-0.5 h-5 w-5 text-primary" /><p className="text-sm">Abra seu aplicativo autenticador e informe o código atual para elevar esta sessão a AAL2.</p></div><OtpField value={code} onChange={setCode} disabled={submitting} /></div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /><div><p className="font-medium text-emerald-900 dark:text-emerald-200">Segundo fator confirmado</p><p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">Esta sessão atende ao nível AAL2 exigido para operações administrativas.</p></div></div>
            )}

            {(enrollment || needsChallenge) && <Button className="h-11 w-full" onClick={verify} disabled={submitting || code.length !== 6}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enrollment ? "Ativar proteção" : "Confirmar e continuar"}</Button>}
            {!required && <Button asChild variant="ghost" className="w-full"><Link to="/modulos">Voltar aos módulos</Link></Button>}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Nunca compartilhe o QR Code, a chave manual ou códigos temporários.</p>
      </div>
    </main>
  );
}
