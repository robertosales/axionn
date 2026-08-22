import { Link } from "react-router-dom";
import { ShieldCheck, Timer, Database, KeyRound, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BACKOFFICE_MFA_REQUIRED } from "@/lib/featureFlags";
import { useMfaStatus } from "@/features/security/hooks/useMfaStatus";

export default function BOConfiguracoes() {
  const { currentLevel, verifiedFactors, loading } = useMfaStatus();
  const mfaEnabled = verifiedFactors.length > 0;
  const items = [
    { icon: ShieldCheck, title: "Acesso interno", text: "Somente membros ativos da Roberto Sales LTDA, controlados por role." },
    { icon: Timer, title: "Sessão", text: "Timeout e autenticação seguem as políticas centrais do Axionn." },
    { icon: Database, title: "Auditoria", text: "Alterações críticas de staff, faturamento e suporte são registradas." },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">Configurações</h1><p className="text-sm text-muted-foreground">Políticas operacionais e de segurança do Backoffice.</p></div>
      <section className="rounded-xl border bg-card p-5" aria-labelledby="mfa-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
            <div><div className="flex flex-wrap items-center gap-2"><h2 id="mfa-title" className="font-semibold">Proteção em duas etapas</h2>{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Consultando status" /> : <Badge variant={mfaEnabled ? "default" : "secondary"}>{mfaEnabled ? "Ativada" : "Não configurada"}</Badge>}</div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Adiciona um código temporário do aplicativo autenticador ao login administrativo.</p></div>
          </div>
          <Button asChild className="min-h-11 shrink-0"><Link to="/security/mfa">{mfaEnabled ? "Verificar sessão" : "Configurar agora"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
          <div className="flex items-start gap-2 text-sm">{BACKOFFICE_MFA_REQUIRED ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />}<span>Política do ambiente: <strong>{BACKOFFICE_MFA_REQUIRED ? "obrigatória" : "modo de preparação"}</strong></span></div>
          <div className="flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /><span>Sessão atual: <strong>{currentLevel === "aal2" ? "AAL2 confirmada" : "AAL1"}</strong></span></div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">{items.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-lg border bg-card p-5"><div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><h2 className="font-semibold">{title}</h2></div><p className="mt-3 text-sm text-muted-foreground">{text}</p></div>)}</div>
    </div>
  );
}
