import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CircleDollarSign, Headphones, Loader2, TrendingDown } from "lucide-react";
import { getSaaSMetrics } from "@/backoffice/services/backoffice.service";
import type { SaaSMetrics } from "@/backoffice/types/backoffice.types";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const empty: SaaSMetrics = { mrr: 0, arr: 0, activeTenants: 0, trialTenants: 0, churnedTenants: 0, churnRate: 0, openTickets: 0, overdueInvoices: 0, paidRevenue: 0 };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function BOAnalitico() {
  const [metrics, setMetrics] = useState(empty);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getSaaSMetrics().then(setMetrics).catch(() => toast.error("Erro ao carregar métricas.")).finally(() => setLoading(false)); }, []);
  const cards = [
    ["MRR", money.format(metrics.mrr), CircleDollarSign], ["ARR", money.format(metrics.arr), CircleDollarSign],
    ["Clientes ativos", metrics.activeTenants.toLocaleString("pt-BR"), Building2], ["Churn", `${metrics.churnRate.toLocaleString("pt-BR")}%`, TrendingDown],
    ["Tickets abertos", metrics.openTickets.toLocaleString("pt-BR"), Headphones], ["Faturas vencidas", metrics.overdueInvoices.toLocaleString("pt-BR"), AlertTriangle],
  ] as const;
  return <div className="space-y-5"><div><h1 className="text-xl font-semibold">Analytics SaaS</h1><p className="text-sm text-muted-foreground">Indicadores calculados a partir da operação atual.</p></div>
    {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" /> : <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="h-6 w-6 text-cyan-700" /></CardContent></Card>)}</div>
      <div className="rounded-lg border bg-white p-5"><h2 className="font-semibold">Resumo comercial</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Em trial</p><p className="text-xl font-medium">{metrics.trialTenants}</p></div><div><p className="text-xs text-muted-foreground">Churned</p><p className="text-xl font-medium">{metrics.churnedTenants}</p></div><div><p className="text-xs text-muted-foreground">Receita paga no mês</p><p className="text-xl font-medium">{money.format(metrics.paidRevenue)}</p></div></div></div>
    </>}
  </div>;
}
