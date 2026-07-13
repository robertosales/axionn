import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  CircleDollarSign,
  Cpu,
  FileText,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface BackofficeSummary {
  total_organizations: number;
  total_teams: number;
  total_briefings: number;
  total_ai_runs: number;
  total_suggestions: number;
  total_applied: number;
  total_failed: number;
  total_usage_events: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_estimated_cost: number;
  avg_duration_ms: number;
  suggestion_approval_rate: number;
  current_month_runs: number;
  current_month_cost: number;
}

interface OrgSummary {
  org_id: string;
  org_name: string;
  plan_code: string;
  total_briefings: number;
  total_runs: number;
  total_suggestions: number;
  total_applied: number;
  total_tokens: number;
  total_cost: number;
  current_month_runs: number;
  monthly_limit: number | null;
  runs_remaining: number | null;
  suggestion_rate: number;
}

interface ProviderSummary {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_duration_ms: number;
  avg_cost_per_run: number;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v}%`;

async function fetchSummary(): Promise<BackofficeSummary> {
  const { data } = await (supabase as any).rpc("get_briefing_backoffice_summary");
  return (data?.[0] ?? {}) as BackofficeSummary;
}

async function fetchByOrg(): Promise<OrgSummary[]> {
  const { data } = await (supabase as any).rpc("get_briefing_backoffice_by_organization");
  return (data ?? []) as OrgSummary[];
}

async function fetchByProvider(): Promise<ProviderSummary[]> {
  const { data } = await (supabase as any).rpc("get_briefing_backoffice_by_provider");
  return (data ?? []) as ProviderSummary[];
}

export default function BOBriefingIA() {
  const [summary, setSummary] = useState<BackofficeSummary | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchByOrg(), fetchByProvider()])
      .then(([s, o, p]) => { setSummary(s); setOrgs(o); setProviders(p); })
      .catch(() => toast.error("Erro ao carregar dados do Briefing IA"))
      .finally(() => setLoading(false));
  }, []);

  const summaryCards = summary
    ? [
        ["Organizacoes", number(summary.total_organizations), Building2],
        ["Equipes", number(summary.total_teams), Users],
        ["Briefings", number(summary.total_briefings), FileText],
        ["Execucoes IA", number(summary.total_ai_runs), Cpu],
        ["Sugestoes", number(summary.total_suggestions), Sparkles],
        ["Itens aplicados", number(summary.total_applied), Bot],
        ["Taxa de aprovacao", pct(summary.suggestion_approval_rate), BarChart3],
        ["Custo total", money.format(summary.total_estimated_cost), CircleDollarSign],
        ["Execucoes no mes", number(summary.current_month_runs), Cpu],
        ["Custo no mes", money.format(summary.current_month_cost), CircleDollarSign],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Briefing IA</h1>
        <p className="text-sm text-muted-foreground">
          Uso, custos e metricas do modulo de Briefing IA em todas as organizacoes.
        </p>
      </div>

      {loading ? (
        <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map(([label, value, Icon]) => (
              <Card key={String(label)}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{String(label)}</p>
                    <p className="mt-1 text-2xl font-semibold">{String(value)}</p>
                  </div>
                  <Icon className="h-6 w-6 text-cyan-700" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Por organizacao
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizacao</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Briefings</TableHead>
                    <TableHead>Execucoes</TableHead>
                    <TableHead>Sugestoes</TableHead>
                    <TableHead>Aplicados</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Mes atual</TableHead>
                    <TableHead>Limite</TableHead>
                    <TableHead>Restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((org) => (
                    <TableRow key={org.org_id}>
                      <TableCell className="font-medium">{org.org_name}</TableCell>
                      <TableCell><Badge variant="outline">{org.plan_code}</Badge></TableCell>
                      <TableCell>{number(org.total_briefings)}</TableCell>
                      <TableCell>{number(org.total_runs)}</TableCell>
                      <TableCell>{number(org.total_suggestions)}</TableCell>
                      <TableCell>{number(org.total_applied)}</TableCell>
                      <TableCell>{pct(org.suggestion_rate)}</TableCell>
                      <TableCell>{money.format(org.total_cost)}</TableCell>
                      <TableCell>{number(org.current_month_runs)}</TableCell>
                      <TableCell>{org.monthly_limit == null ? "Ilimitado" : number(org.monthly_limit)}</TableCell>
                      <TableCell>{org.runs_remaining == null ? "-" : number(org.runs_remaining)}</TableCell>
                    </TableRow>
                  ))}
                  {orgs.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">Nenhum dado encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" /> Por provedor de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Sucesso</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Tokens (in/out)</TableHead>
                    <TableHead>Custo total</TableHead>
                    <TableHead>Custo medio</TableHead>
                    <TableHead>Duracao media</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.provider_id}>
                      <TableCell className="font-medium">{p.provider_name}</TableCell>
                      <TableCell><Badge variant="secondary">{p.provider_type}</Badge></TableCell>
                      <TableCell>{number(p.total_runs)}</TableCell>
                      <TableCell>{number(p.success_runs)}</TableCell>
                      <TableCell>{number(p.failed_runs)}</TableCell>
                      <TableCell>{number(p.total_input_tokens)} / {number(p.total_output_tokens)}</TableCell>
                      <TableCell>{money.format(p.total_cost)}</TableCell>
                      <TableCell>{money.format(p.avg_cost_per_run)}</TableCell>
                      <TableCell>{(p.avg_duration_ms / 1000).toFixed(1)}s</TableCell>
                    </TableRow>
                  ))}
                  {providers.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhum processamento realizado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
