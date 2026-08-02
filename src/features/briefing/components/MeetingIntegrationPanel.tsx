import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarSync,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  completeTeamsAuthorization,
  importTeamsMeeting,
  listExternalMeetings,
  listMeetingConnections,
  startTeamsAuthorization,
  syncTeamsMeetings,
  testTeamsConnection,
  type ExternalMeetingSummary,
  type MeetingConnectionSummary,
} from "../services/meetingIntegrations.service";

interface MeetingIntegrationPanelProps {
  organizationId: string;
  teamId: string;
  onBriefingImported: (briefingId: string) => Promise<void>;
}

const STATUS_LABELS: Record<MeetingConnectionSummary["status"], string> = {
  connecting: "Conectando",
  healthy: "Saudável",
  syncing: "Sincronizando",
  attention_required: "Requer atenção",
  insufficient_permission: "Permissão insuficiente",
  token_expired: "Token expirado",
  access_revoked: "Acesso revogado",
  disabled: "Desabilitada",
};

function callbackUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function errorCode(error: unknown) {
  if (!(error instanceof Error)) return "MEETING_CONNECTOR_FAILED";
  return error.name === "Error" ? error.message : error.name;
}

export function MeetingIntegrationPanel({
  organizationId,
  teamId,
  onBriefingImported,
}: MeetingIntegrationPanelProps) {
  const [connections, setConnections] = useState<MeetingConnectionSummary[]>([]);
  const [meetings, setMeetings] = useState<ExternalMeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const callbackStarted = useRef(false);

  const teamsConnection = useMemo(
    () => connections.find((connection) => connection.provider === "microsoft_teams"),
    [connections],
  );

  const refresh = useCallback(async () => {
    const [connectionRows, meetingRows] = await Promise.all([
      listMeetingConnections(organizationId),
      listExternalMeetings(organizationId),
    ]);
    setConnections(connectionRows);
    setMeetings(meetingRows.filter((meeting) => meeting.provider === "microsoft_teams"));
  }, [organizationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((error) => {
        console.error("[MeetingIntegrationPanel] load failed", error);
        if (!cancelled) toast.error("Não foi possível carregar as integrações de reunião.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const code = parameters.get("code");
    const state = parameters.get("state");
    const providerError = parameters.get("error");
    if ((!code && !providerError) || callbackStarted.current) return;
    callbackStarted.current = true;

    const cleanCallbackUrl = () => {
      for (const key of ["code", "state", "session_state", "error", "error_description"]) {
        parameters.delete(key);
      }
      const query = parameters.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    };

    if (providerError || !code || !state) {
      cleanCallbackUrl();
      toast.error("A autorização do Microsoft Teams foi cancelada ou recusada.");
      return;
    }

    setAction("callback");
    completeTeamsAuthorization(code, state)
      .then(async () => {
        cleanCallbackUrl();
        await refresh();
        toast.success("Microsoft Teams conectado com segurança.");
      })
      .catch((error) => {
        cleanCallbackUrl();
        console.error("[MeetingIntegrationPanel] OAuth callback failed", errorCode(error));
        toast.error("Não foi possível concluir a conexão com o Microsoft Teams.");
      })
      .finally(() => setAction(null));
  }, [refresh]);

  const connect = async () => {
    setAction("authorize");
    try {
      const { authorizationUrl } = await startTeamsAuthorization(
        organizationId,
        callbackUrl(),
      );
      window.location.assign(authorizationUrl);
    } catch (error) {
      console.error("[MeetingIntegrationPanel] authorization failed", errorCode(error));
      toast.error("Não foi possível iniciar a conexão com o Microsoft Teams.");
      setAction(null);
    }
  };

  const checkHealth = async () => {
    if (!teamsConnection) return;
    setAction("health");
    try {
      await testTeamsConnection(teamsConnection.id);
      await refresh();
      toast.success("Conexão com o Teams validada.");
    } catch (error) {
      console.error("[MeetingIntegrationPanel] health check failed", errorCode(error));
      toast.error("A conexão requer atenção ou nova autorização.");
    } finally {
      setAction(null);
    }
  };

  const sync = async () => {
    if (!teamsConnection) return;
    setAction("sync");
    try {
      const result = await syncTeamsMeetings(teamsConnection.id);
      await refresh();
      toast.success(`${result.discovered} reunião(ões) localizada(s).`);
    } catch (error) {
      console.error("[MeetingIntegrationPanel] manual sync failed", errorCode(error));
      toast.error("Não foi possível sincronizar as reuniões do Teams.");
    } finally {
      setAction(null);
    }
  };

  const importMeeting = async (meeting: ExternalMeetingSummary) => {
    setAction(`import:${meeting.id}`);
    try {
      const result = await importTeamsMeeting({
        meetingId: meeting.id,
        teamId,
        briefingType: "free",
      });
      await onBriefingImported(result.briefingId);
      toast.success(result.duplicate ? "Briefing já importado; registro aberto." : "Transcrição importada para revisão.");
    } catch (error) {
      console.error("[MeetingIntegrationPanel] import failed", errorCode(error));
      toast.error("Não foi possível importar esta reunião.");
    } finally {
      setAction(null);
    }
  };

  return (
    <Card className="overflow-hidden border-blue-500/25">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5 text-blue-600" />
            Reuniões do Microsoft Teams
          </CardTitle>
          <CardDescription className="mt-1">
            Importe transcrições com participantes e timestamps. A sincronização permanece manual.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {teamsConnection ? (
            <>
              <Button variant="outline" size="sm" disabled={action !== null} onClick={() => void checkHealth()}>
                {action === "health" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Testar conexão
              </Button>
              <Button size="sm" disabled={action !== null} onClick={() => void sync()}>
                {action === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Buscar reuniões
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={loading || action !== null} onClick={() => void connect()}>
              {action === "authorize" || action === "callback" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Conectar Teams
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando integração
          </div>
        ) : teamsConnection ? (
          <>
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="truncate text-sm font-medium">{teamsConnection.displayName}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última sincronização: {teamsConnection.lastSyncedAt ? new Date(teamsConnection.lastSyncedAt).toLocaleString("pt-BR") : "ainda não realizada"}
                </p>
              </div>
              <Badge variant={teamsConnection.status === "healthy" ? "default" : "secondary"}>
                {STATUS_LABELS[teamsConnection.status]}
              </Badge>
            </div>

            {meetings.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                <CalendarSync className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Nenhuma reunião sincronizada</p>
                <p className="mt-1 text-xs text-muted-foreground">Use “Buscar reuniões” para consultar o período inicial configurado.</p>
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{meeting.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(meeting.startsAt).toLocaleString("pt-BR")}
                        {meeting.organizerName ? ` · ${meeting.organizerName}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={meeting.hasTranscript ? "outline" : "secondary"}>
                        {meeting.hasTranscript ? "Transcrição disponível" : "Aguardando transcrição"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!meeting.hasTranscript || action !== null}
                        onClick={() => void importMeeting(meeting)}
                      >
                        {action === `import:${meeting.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Importar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-6">
            <p className="text-sm font-medium">Conexão delegada para o piloto</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Você será direcionado à Microsoft. O Axionn armazena os tokens no Vault e não ativa sincronização automática nem acesso a gravações.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
