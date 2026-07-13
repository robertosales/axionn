import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Copy, Eye, GitBranch } from "lucide-react";

interface GitlabEventsPanelProps {
  integrationId: string | null;
}

interface GitEventRow {
  id: string;
  event_type: string;
  event_action: string | null;
  provider_event_id: string | null;
  processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  correlation_id: string | null;
  received_at: string;
  payload: unknown;
}

const PAGE_SIZE = 20;

const TYPE_COLOR: Record<string, string> = {
  push: "bg-blue-100 text-blue-700",
  merge_request: "bg-purple-100 text-purple-700",
  pipeline: "bg-amber-100 text-amber-700",
  deployment: "bg-emerald-100 text-emerald-700",
  job: "bg-slate-100 text-slate-700",
  note: "bg-slate-100 text-slate-700",
};

function periodStart(range: "24h" | "7d" | "30d"): string {
  const now = Date.now();
  const map = { "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3, "30d": 30 * 24 * 3600e3 };
  return new Date(now - map[range]).toISOString();
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
}

export function GitlabEventsPanel({ integrationId }: GitlabEventsPanelProps) {
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [page, setPage] = useState(1);
  const [viewingPayload, setViewingPayload] = useState<GitEventRow | null>(null);

  const from = periodStart(period);

  const query = useQuery({
    queryKey: ["gitlab-events", integrationId, typeFilter, statusFilter, period, page],
    queryFn: async () => {
      if (!integrationId) return { rows: [] as GitEventRow[], count: 0 };
      let q = supabase
        .from("git_events")
        .select(
          "id, event_type, event_action, provider_event_id, processed, processed_at, processing_error, correlation_id, received_at, payload",
          { count: "exact" },
        )
        .eq("integration_id", integrationId)
        .gte("received_at", from)
        .order("received_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (typeFilter !== "todos") q = q.eq("event_type", typeFilter);
      if (statusFilter === "processado") q = q.eq("processed", true).is("processing_error", null);
      if (statusFilter === "pendente") q = q.eq("processed", false);
      if (statusFilter === "erro") q = q.not("processing_error", "is", null);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as GitEventRow[], count: count ?? 0 };
    },
    enabled: !!integrationId,
    refetchInterval: 30_000,
  });

  const kpis = useQuery({
    queryKey: ["gitlab-events-kpis", integrationId, period],
    queryFn: async () => {
      if (!integrationId) return { total: 0, processed: 0, errored: 0 };
      const base = supabase
        .from("git_events")
        .select("id", { count: "exact", head: true })
        .eq("integration_id", integrationId)
        .gte("received_at", from);
      const [{ count: total }, { count: processed }, { count: errored }] = await Promise.all([
        base,
        supabase
          .from("git_events")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", integrationId)
          .gte("received_at", from)
          .eq("processed", true)
          .is("processing_error", null),
        supabase
          .from("git_events")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", integrationId)
          .gte("received_at", from)
          .not("processing_error", "is", null),
      ]);
      return { total: total ?? 0, processed: processed ?? 0, errored: errored ?? 0 };
    },
    enabled: !!integrationId,
    refetchInterval: 30_000,
  });

  const successRate = useMemo(() => {
    const t = kpis.data?.total ?? 0;
    if (!t) return "0.0";
    return (((kpis.data?.processed ?? 0) / t) * 100).toFixed(1);
  }, [kpis.data]);

  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  if (!integrationId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Selecione uma integração para visualizar os eventos recebidos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: kpis.data?.total ?? 0, tone: "text-slate-900" },
          { label: "Processados", value: kpis.data?.processed ?? 0, tone: "text-emerald-600" },
          { label: "Com erro", value: kpis.data?.errored ?? 0, tone: "text-rose-600" },
          { label: "Taxa de sucesso", value: `${successRate}%`, tone: "text-blue-600" },
        ].map(({ label, value, tone }) => (
          <Card key={label} className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-semibold ${tone}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => { setPage(1); setTypeFilter(v); }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="merge_request">Merge Request</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="deployment">Deployment</SelectItem>
              <SelectItem value="job">Job</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="processado">Processado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => { setPage(1); setPeriod(v as any); }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { query.refetch(); kpis.refetch(); }}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        {query.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (query.data?.rows.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <GitBranch className="h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-500 max-w-md">
              Nenhum evento recebido ainda. Configure o webhook URL no GitLab apontando para a URL da Edge Function.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Provider Event ID</th>
                  <th className="px-4 py-3">Recebido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Correlation</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {query.data!.rows.map((row) => {
                  const badgeColor = TYPE_COLOR[row.event_type] ?? "bg-slate-100 text-slate-700";
                  const statusBadge = row.processing_error
                    ? { label: "Erro", cls: "bg-rose-100 text-rose-700" }
                    : row.processed
                    ? { label: "Processado", cls: "bg-emerald-100 text-emerald-700" }
                    : { label: "Pendente", cls: "bg-amber-100 text-amber-700" };
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${badgeColor}`}>
                          {row.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.event_action ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600" title={row.provider_event_id ?? ""}>
                        {row.provider_event_id ? truncate(row.provider_event_id, 28) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(row.received_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadge.cls}`}
                          title={row.processing_error ?? undefined}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.correlation_id ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">{row.correlation_id.slice(0, 8)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(row.correlation_id!)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setViewingPayload(row)}>
                          <Eye className="h-3 w-3" /> Payload
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!viewingPayload} onOpenChange={(o) => !o && setViewingPayload(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Payload do evento</SheetTitle>
            <SheetDescription>
              {viewingPayload?.event_type} • {viewingPayload?.provider_event_id ?? "sem id"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => viewingPayload && copyText(JSON.stringify(viewingPayload.payload, null, 2))}
            >
              <Copy className="h-4 w-4" /> Copiar tudo
            </Button>
          </div>
          <pre className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{viewingPayload ? JSON.stringify(viewingPayload.payload, null, 2) : ""}
          </pre>
        </SheetContent>
      </Sheet>
    </div>
  );
}
