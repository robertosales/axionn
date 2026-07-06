import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useOrganizationSettings } from "@/features/organization/hooks/useOrganizationSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const FIELD_LABELS: Record<string, string> = {
  name: "Nome da organização",
  contact_name: "Nome do contato",
  contact_email: "E-mail de contato",
  logo_url: "Logo",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trial: "Em avaliação",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

function formatDate(value: string) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function OrganizationSettingsPage() {
  const navigate = useNavigate();
  const {
    organization,
    settings,
    audit,
    loading,
    saving,
    error,
    refresh,
    updateSettings,
  } = useOrganizationSettings();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!settings) return;
    setName(settings.name);
    setContactName(settings.contactName);
    setContactEmail(settings.contactEmail);
    setLogoUrl(settings.logoUrl);
  }, [settings]);

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return (
      name.trim() !== settings.name ||
      contactName.trim() !== settings.contactName ||
      contactEmail.trim().toLowerCase() !== settings.contactEmail ||
      logoUrl.trim() !== settings.logoUrl
    );
  }, [contactEmail, contactName, logoUrl, name, settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        name: name.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        logoUrl: logoUrl.trim(),
      });
      toast.success("Configurações da organização atualizadas.");
    } catch (saveError) {
      console.error("[OrganizationSettingsPage] save failed", saveError);
      const message = saveError instanceof Error ? saveError.message : "";
      if (message.includes("invalid_contact_email")) {
        toast.error("Informe um e-mail de contato válido.");
      } else if (message.includes("invalid_logo_url")) {
        toast.error("A URL da logo deve começar com https://.");
      } else if (message.includes("invalid_name")) {
        toast.error("O nome deve ter entre 2 e 120 caracteres.");
      } else {
        toast.error("Não foi possível salvar as configurações.");
      }
    }
  };

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Alert className="max-w-xl">
          <AlertDescription>
            Selecione uma organização para editar as configurações.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">
                Configurações da organização
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {organization.name}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:px-8">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Identidade e contato</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dados visíveis nos contextos administrativos da organização.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {PLAN_LABELS[settings?.plan ?? organization.plan] ??
                      settings?.plan ??
                      organization.plan}
                  </Badge>
                  <Badge variant="outline">
                    {STATUS_LABELS[settings?.status ?? organization.status] ??
                      settings?.status ??
                      organization.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="organization-name">Nome da organização</Label>
                      <Input
                        id="organization-name"
                        value={name}
                        maxLength={120}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organization-slug">Identificador</Label>
                      <Input
                        id="organization-slug"
                        value={settings?.slug ?? organization.slug}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        O identificador técnico não pode ser alterado nesta tela.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Nome do contato</Label>
                      <Input
                        id="contact-name"
                        value={contactName}
                        maxLength={120}
                        placeholder="Responsável administrativo"
                        onChange={(event) => setContactName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-mail de contato</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={contactEmail}
                        placeholder="contato@empresa.com.br"
                        onChange={(event) => setContactEmail(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logo-url">URL da logo</Label>
                      <Input
                        id="logo-url"
                        type="url"
                        value={logoUrl}
                        placeholder="https://..."
                        onChange={(event) => setLogoUrl(event.target.value)}
                      />
                    </div>
                  </div>

                  {logoUrl && (
                    <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border bg-background">
                        <img
                          src={logoUrl}
                          alt="Prévia da logo"
                          className="h-full w-full object-contain p-1"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Prévia da identidade</p>
                        <p className="text-xs text-muted-foreground">
                          A imagem deve estar disponível por HTTPS.
                        </p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      Última atualização: {formatDate(settings?.updatedAt ?? "")}
                    </p>
                    <Button
                      disabled={!hasChanges || saving || name.trim().length < 2}
                      onClick={() => void handleSave()}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {saving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Clock3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Histórico de alterações</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Últimas mudanças registradas nesta organização.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : audit.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium">Nenhuma alteração registrada</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  As próximas edições aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {audit.map((entry) => (
                  <div key={entry.auditId} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {entry.actorName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.actorEmail || "Conta interna"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.changedFields.map((field) => (
                        <Badge key={field} variant="secondary">
                          {FIELD_LABELS[field] ?? field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
