import { useEffect, useState } from "react";
import { Building2, CreditCard, Loader2, ShieldCheck, Users } from "lucide-react";
import { getBackofficeDashboardSummary } from "@/backoffice/services/backoffice.service";
import type { BackofficeDashboardSummary } from "@/backoffice/types/backoffice.types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EMPTY_SUMMARY: BackofficeDashboardSummary = {
  totalTenants: 0,
  activeTenants: 0,
  trialTenants: 0,
  suspendedTenants: 0,
  staffMembers: 0,
  activeStaffMembers: 0,
  activeSubscriptions: 0,
  pastDueSubscriptions: 0,
};

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">
            {new Intl.NumberFormat("pt-BR").format(value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function BODashboard() {
  const [summary, setSummary] = useState<BackofficeDashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getBackofficeDashboardSummary();
        if (!cancelled) setSummary(data);
      } catch (err) {
        console.error("[Backoffice] dashboard", err);
        if (!cancelled) setError("Nao foi possivel carregar o dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Dashboard interno</h1>
        <p className="text-sm text-muted-foreground">
          Visao operacional da Roberto Sales LTDA sobre a plataforma Axionn.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Clientes"
            value={summary.totalTenants}
            detail={`${summary.activeTenants} ativos, ${summary.trialTenants} em trial`}
            icon={Building2}
          />
          <MetricCard
            title="Assinaturas ativas"
            value={summary.activeSubscriptions}
            detail={`${summary.pastDueSubscriptions} com pendencia`}
            icon={CreditCard}
          />
          <MetricCard
            title="Staff ativo"
            value={summary.activeStaffMembers}
            detail={`${summary.staffMembers} cadastrados`}
            icon={Users}
          />
          <MetricCard
            title="Clientes suspensos"
            value={summary.suspendedTenants}
            detail="Operacao bloqueada ou em saneamento"
            icon={ShieldCheck}
          />
        </div>
      )}
    </div>
  );
}
