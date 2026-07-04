import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  LogIn,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InvitationPreview {
  organizationName: string;
  maskedEmail: string;
  invitationRole: string;
  expiresAt: string;
  invitationStatus: string;
}

interface AcceptanceResult {
  organizationId: string | null;
  organizationName: string | null;
  membershipRole: string | null;
  accepted: boolean;
  resultStatus: string;
}

function normalizePreview(row: Record<string, unknown>): InvitationPreview {
  return {
    organizationName: String(row.organization_name ?? "Organização"),
    maskedEmail: String(row.masked_email ?? ""),
    invitationRole: String(row.invitation_role ?? "member"),
    expiresAt: String(row.expires_at ?? ""),
    invitationStatus: String(row.invitation_status ?? "invalid"),
  };
}

function normalizeResult(row: Record<string, unknown>): AcceptanceResult {
  return {
    organizationId:
      row.organization_id == null ? null : String(row.organization_id),
    organizationName:
      row.organization_name == null ? null : String(row.organization_name),
    membershipRole:
      row.membership_role == null ? null : String(row.membership_role),
    accepted: Boolean(row.accepted),
    resultStatus: String(row.result_status ?? "invalid"),
  };
}

export default function AcceptOrganizationInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { session, loading: authLoading } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [result, setResult] = useState<AcceptanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      if (!token) {
        setError("O link de convite está incompleto.");
        setLoading(false);
        return;
      }

      const { data, error: previewError } = await (supabase as any).rpc(
        "get_organization_invitation_preview",
        { p_token: token },
      );

      if (!active) return;

      if (previewError) {
        console.error("[AcceptOrganizationInvitation] preview", previewError);
        setError("Não foi possível validar este convite.");
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) setError("Convite inválido ou não encontrado.");
        else setPreview(normalizePreview(row as Record<string, unknown>));
      }
      setLoading(false);
    };

    void loadPreview();
    return () => {
      active = false;
    };
  }, [token]);

  const canAccept = useMemo(
    () =>
      preview?.invitationStatus === "pending" &&
      Boolean(token) &&
      Boolean(session),
    [preview?.invitationStatus, session, token],
  );

  const acceptInvitation = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);

    const { data, error: acceptError } = await (supabase as any).rpc(
      "accept_organization_invitation",
      { p_token: token },
    );

    if (acceptError) {
      console.error("[AcceptOrganizationInvitation] accept", acceptError);
      setError(
        acceptError.message?.includes("email_mismatch")
          ? "Este convite foi enviado para outro endereço de e-mail."
          : "Não foi possível aceitar o convite.",
      );
      setAccepting(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const normalized = row
      ? normalizeResult(row as Record<string, unknown>)
      : null;
    setResult(normalized);

    if (normalized?.accepted && normalized.organizationId) {
      localStorage.setItem("selectedOrganizationId", normalized.organizationId);
      await refreshOrganizations();
    }

    setAccepting(false);
  };

  const continueToAxion = () => {
    if (result?.organizationId) {
      localStorage.setItem("selectedOrganizationId", result.organizationId);
    }
    window.location.assign("/modulos");
  };

  const roleLabel =
    preview?.invitationRole === "admin" ? "Administrador" : "Membro";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {result?.accepted ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            ) : (
              <Building2 className="h-7 w-7 text-primary" />
            )}
          </div>
          <div>
            <CardTitle className="text-xl">
              {result?.accepted ? "Convite aceito" : "Convite para organização"}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {result?.accepted
                ? `Você agora faz parte de ${result.organizationName ?? "sua organização"}.`
                : "Confirme o acesso antes de continuar para o Axion."}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {(loading || authLoading) && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando convite...
            </div>
          )}

          {!loading && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && preview && !result?.accepted && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Organização
                    </p>
                    <p className="mt-1 font-semibold">
                      {preview.organizationName}
                    </p>
                  </div>
                  <Badge variant="secondary">{roleLabel}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {preview.maskedEmail}
                </div>
              </div>

              {preview.invitationStatus !== "pending" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {preview.invitationStatus === "expired"
                      ? "Este convite expirou. Solicite um novo envio ao administrador."
                      : preview.invitationStatus === "revoked"
                        ? "Este convite foi revogado."
                        : "Este convite já foi utilizado."}
                  </AlertDescription>
                </Alert>
              )}

              {!session && preview.invitationStatus === "pending" && (
                <Alert>
                  <LogIn className="h-4 w-4" />
                  <AlertDescription>
                    Entre com o mesmo e-mail que recebeu o convite para concluir o acesso.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                disabled={!canAccept || accepting}
                onClick={() => void acceptInvitation()}
              >
                {accepting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Aceitar convite
              </Button>

              {!session && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/auth?next=${encodeURIComponent(`/accept-invitation?token=${token}`)}`,
                    )
                  }
                >
                  Entrar no Axion
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {result?.accepted && (
            <Button className="w-full" onClick={continueToAxion}>
              Continuar para o Axion
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
