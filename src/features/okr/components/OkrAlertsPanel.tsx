import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOkrAlertsV2 } from "../hooks/useOkrAlertsV2";
import { OKR_ALERT_RULE_LABEL } from "../types/alert";

export function OkrAlertsPanel() {
  const alerts = useOkrAlertsV2("open");

  const handleRun = async () => {
    try {
      const count = await alerts.runEngine.mutateAsync();
      toast.success(`Motor de alertas executado (${count ?? 0} detecções).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar motor de alertas.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alertas abertos ({alerts.alerts.length})</CardTitle>
        <Button size="sm" variant="outline" onClick={handleRun} disabled={alerts.runEngine.isPending}>
          Reavaliar alertas
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : alerts.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta aberto.</p>
        ) : (
          alerts.alerts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  {OKR_ALERT_RULE_LABEL[a.rule_code ?? ""] ?? a.rule_code} · ocorrências: {a.occurrence_count ?? 1}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{a.severity}</Badge>
                <Button size="sm" variant="outline" onClick={() => alerts.acknowledge.mutateAsync({ id: a.id })}>
                  Ciente
                </Button>
                <Button size="sm" variant="ghost" onClick={() => alerts.resolve.mutateAsync({ id: a.id })}>
                  Resolver
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}