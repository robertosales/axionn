import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Eye,
  GitBranch,
  GitMerge,
  Inbox,
  MessageSquare,
  RefreshCw,
  Rocket,
  RotateCcw,
  ServerCog,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

interface HUCorrelation {
  hu_id: string;
  correlation_id: string;
  git_entity_type: string;
  code: string;
  title: string;
  status: string;
}

interface HUCorrelationQueryRow {
  hu_id: string;
  correlation_id: string | null;
  git_entity_type: string;
  user_stories:
    | { code: string; title: string; status: string }
    | { code: string; title: string; status: string }[]
    | null;
}

type Period = "24h" | "7d" | "30d";
type EventStatus = "processed" | "pending" | "error";
type HUCorrelationState = "loading" | "error" | "ready";
type TimelineView = "general" | "hu";

interface GitlabTimelineEntry {
  event: GitEventRow;
  project: string | null;
  workItems: HUCorrelation[];
  workItemState: HUCorrelationState;
  groupingContext: {
    huIds: string[];
    project: string | null;
  };
}

const PAGE_SIZE = 20;

type GitlabEventType = "push" | "merge_request" | "pipeline" | "deployment" | "job" | "note";
type NormalizedGitlabEventType = GitlabEventType | "unknown";

const EVENT_TYPES: GitlabEventType[] = [
  "push",
  "merge_request",
  "pipeline",
  "deployment",
  "job",
  "note",
];

const EVENT_META: Record<GitlabEventType, { label: string; icon: typeof GitBranch; className: string }> = {
  push: {
    label: "Push Hook",
    icon: GitBranch,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  merge_request: {
    label: "Merge Request Hook",
    icon: GitMerge,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  pipeline: {
    label: "Pipeline Hook",
    icon: ServerCog,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  deployment: {
    label: "Deployment Hook",
    icon: Rocket,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  job: {
    label: "Job Hook",
    icon: CircleDot,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  note: {
    label: "Note Hook",
    icon: MessageSquare,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function periodStart(range: Period): string {
  const intervals = {
    "24h": 24 * 3600e3,
    "7d": 7 * 24 * 3600e3,
    "30d": 30 * 24 * 3600e3,
  };
  return new Date(Date.now() - intervals[range]).toISOString();
}

export function normalizeEventType(
  rawType: string | null | undefined,
  payload: unknown,
): NormalizedGitlabEventType {
  const payloadRecord = asRecord(payload);
  const payloadCandidates = [
    typeof rawType === "string" ? rawType : null,
    payloadRecord?.object_kind,
    payloadRecord?.event_type,
    payloadRecord?.event_name,
    payloadRecord?.kind,
  ];

  for (const candidate of payloadCandidates) {
    if (typeof candidate !== "string") continue;

    const value = candidate.trim().toLowerCase();
    if (!value) continue;

    const compactValue = value.replace(/[\s-]+/g, "_").replace(/_hook$/, "").replace(/_event$/, "").replace(/_events$/, "");

    if (compactValue.includes("merge_request") || compactValue.includes("merge")) {
      return "merge_request";
    }
    if (compactValue.includes("push")) return "push";
    if (compactValue.includes("pipeline")) return "pipeline";
    if (compactValue.includes("deployment")) return "deployment";
    if (compactValue.includes("job")) return "job";
    if (compactValue.includes("note") || compactValue.includes("comment") || compactValue.includes("discussion")) {
      return "note";
    }
  }

  const objectAttributes = asRecord(payloadRecord?.object_attributes);
  const action = typeof objectAttributes?.action === "string" ? objectAttributes.action.trim().toLowerCase() : "";
  if (action.includes("comment") || action.includes("note")) {
    return "note";
  }

  return "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getEventProject(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;
  const project = asRecord(root.project);
  const repository = asRecord(root.repository);
  const candidates = [
    project?.path_with_namespace,
    project?.name,
    repository?.name,
    root.project_name,
  ];
  const match = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof match === "string" ? match : null;
}

function getEventStatus(row: GitEventRow): EventStatus {
  if (row.processing_error) return "error";
  return row.processed ? "processed" : "pending";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function compactId(value: string | null, size = 12) {
  if (!value) return "—";
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

function formatPayload(payload: unknown): { content: string | null; error: boolean } {
  if (payload == null) return { content: null, error: false };
  if (Array.isArray(payload) && payload.length === 0) return { content: null, error: false };
  if (asRecord(payload) && Object.keys(payload as Record<string, unknown>).length === 0) {
    return { content: null, error: false };
  }

  try {
    return { content: JSON.stringify(payload, null, 2), error: false };
  } catch {
    return { content: null, error: true };
  }
}

function StatusBadge({ status }: { status: EventStatus }) {
  const meta = {
    processed: {
      label: "Processado",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    pending: {
      label: "Recebido",
      icon: Clock3,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    error: {
      label: "Com erro",
      icon: AlertCircle,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    },
  }[status];
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap font-medium", meta.className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

function WorkItemContext({
  correlations,
  state,
  variant,
  project,
}: {
  correlations: HUCorrelation[];
  state: HUCorrelationState;
  variant: "timeline" | "details";
  project?: string | null;
}) {
  if (variant === "timeline") {
    return (
      <div
        data-slot="event-work-item-context"
        className="mt-2 flex min-w-0 items-center gap-1.5 rounded-md bg-muted/35 px-2 py-1.5 text-xs text-muted-foreground sm:w-fit sm:max-w-full"
        aria-live="polite"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {state === "loading" ? (
          <span>Verificando vínculo com HU</span>
        ) : state === "error" ? (
          <span>Vínculo com HU indisponível</span>
        ) : correlations.length > 0 ? (
          <span
            className="min-w-0 truncate"
            title={`${correlations[0].code} — ${correlations[0].title}`}
          >
            <span className="font-mono font-medium text-foreground/75">
              {correlations[0].code}
            </span>
            <span> — {correlations[0].title}</span>
            {correlations.length > 1 && (
              <span className="whitespace-nowrap text-muted-foreground">
                {" "}+{correlations.length - 1} HU{correlations.length > 2 ? "s" : ""}
              </span>
            )}
          </span>
        ) : (
          <span>HU não vinculada</span>
        )}
      </div>
    );
  }

  return (
    <div data-slot="event-work-item-details" className="rounded-xl border border-border/70 p-4">
      <div className="flex items-start gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Contexto de trabalho</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vínculos confirmados com este evento
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Projeto: <span className="font-medium text-foreground/80">{project ?? "não informado"}</span>
      </p>
      {state === "loading" ? (
        <Skeleton className="mt-3 h-10 w-full rounded-lg" />
      ) : state === "error" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          O vínculo com HU não pôde ser consultado neste momento.
        </p>
      ) : correlations.length > 0 ? (
        <div className="mt-3 space-y-2">
          {correlations.map((correlation) => (
            <div key={correlation.hu_id} className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {correlation.code}
                </span>
                <Badge variant="secondary" className="h-5 font-normal">
                  {correlation.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-foreground/80">{correlation.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Entidade Git vinculada: {correlation.git_entity_type.replaceAll("_", " ")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-muted/20 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground/80">HU não vinculada</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Não há vínculo confirmado para este evento.
          </p>
        </div>
      )}
    </div>
  );
}

export function GitlabEventsPanel({ integrationId }: GitlabEventsPanelProps) {
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [projectFilter, setProjectFilter] = useState("todos");
  const [period, setPeriod] = useState<Period>("7d");
  const [page, setPage] = useState(1);
  const [viewingPayload, setViewingPayload] = useState<GitEventRow | null>(null);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [timelineView, setTimelineView] = useState<TimelineView>("general");
  const [selectedHUId, setSelectedHUId] = useState<string | null>(null);
  const from = periodStart(period);

  const query = useQuery({
    queryKey: ["gitlab-events", integrationId, typeFilter, statusFilter, period],
    queryFn: async () => {
      if (!integrationId) return { rows: [] as GitEventRow[], count: 0 };
      let request = supabase
        .from("git_events")
        .select(
          "id, event_type, event_action, provider_event_id, processed, processed_at, processing_error, correlation_id, received_at, payload",
          { count: "exact" },
        )
        .eq("integration_id", integrationId)
        .gte("received_at", from)
        .order("received_at", { ascending: false });

      if (statusFilter === "processado") {
        request = request.eq("processed", true).is("processing_error", null);
      }
      if (statusFilter === "pendente") request = request.eq("processed", false);
      if (statusFilter === "erro") request = request.not("processing_error", "is", null);

      const { data, count, error } = await request;
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
      const makeCount = () =>
        supabase
          .from("git_events")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", integrationId)
          .gte("received_at", from);
      const [{ count: total, error: totalError }, processedResult, errorResult] =
        await Promise.all([
          makeCount(),
          makeCount().eq("processed", true).is("processing_error", null),
          makeCount().not("processing_error", "is", null),
        ]);
      const error = totalError ?? processedResult.error ?? errorResult.error;
      if (error) throw error;
      return {
        total: total ?? 0,
        processed: processedResult.count ?? 0,
        errored: errorResult.count ?? 0,
      };
    },
    enabled: !!integrationId,
    refetchInterval: 30_000,
  });

  const eventCorrelationIds = useMemo(
    () =>
      Array.from(
        new Set((query.data?.rows ?? []).map((row) => row.correlation_id).filter(Boolean)),
      ) as string[],
    [query.data?.rows],
  );

  const huCorrelations = useQuery({
    queryKey: ["gitlab-event-hu-correlations", integrationId, eventCorrelationIds],
    queryFn: async (): Promise<HUCorrelation[]> => {
      if (!integrationId || eventCorrelationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("hu_git_links")
        .select(
          "hu_id, correlation_id, git_entity_type, user_stories!hu_git_links_hu_id_fkey(code, title, status)",
        )
        .eq("integration_id", integrationId)
        .in("correlation_id", eventCorrelationIds);
      if (error) throw error;

      const links = (data ?? []) as unknown as HUCorrelationQueryRow[];
      return links.flatMap((link) => {
        const story = Array.isArray(link.user_stories)
          ? link.user_stories[0]
          : link.user_stories;
        if (!link.correlation_id || !story?.code || !story?.title) return [];
        return [{
          hu_id: link.hu_id,
          correlation_id: link.correlation_id,
          git_entity_type: link.git_entity_type,
          code: story.code,
          title: story.title,
          status: story.status,
        }];
      });
    },
    enabled: !!integrationId && eventCorrelationIds.length > 0,
    staleTime: 60_000,
  });

  const correlationsByEvent = useMemo(() => {
    const map = new Map<string, HUCorrelation[]>();
    for (const correlation of huCorrelations.data ?? []) {
      const current = map.get(correlation.correlation_id) ?? [];
      if (!current.some((item) => item.hu_id === correlation.hu_id)) {
        current.push(correlation);
        map.set(correlation.correlation_id, current);
      }
    }
    return map;
  }, [huCorrelations.data]);

  const projects = useMemo(
    () =>
      Array.from(
        new Set((query.data?.rows ?? []).map((row) => getEventProject(row.payload)).filter(Boolean)),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [query.data?.rows],
  );
  const filteredRows = useMemo(() => {
    const normalizedRows = (query.data?.rows ?? []).filter((row) => {
      const matchesType =
        typeFilter === "todos" || normalizeEventType(row.event_type, row.payload) === typeFilter;
      const matchesProject =
        projectFilter === "todos" || getEventProject(row.payload) === projectFilter;
      return matchesType && matchesProject;
    });

    return normalizedRows;
  }, [projectFilter, query.data?.rows, typeFilter]);

  const successRate = useMemo(() => {
    const total = kpis.data?.total ?? 0;
    return total ? Math.round(((kpis.data?.processed ?? 0) / total) * 1000) / 10 : 0;
  }, [kpis.data]);
  const payloadView = useMemo(
    () => formatPayload(viewingPayload?.payload),
    [viewingPayload?.payload],
  );
  const selectedHUCorrelations = viewingPayload?.correlation_id
    ? correlationsByEvent.get(viewingPayload.correlation_id) ?? []
    : [];
  const correlationQueryState: HUCorrelationState = huCorrelations.isLoading
    ? "loading"
    : huCorrelations.isError
      ? "error"
      : "ready";
  const timelineEntries = useMemo<GitlabTimelineEntry[]>(
    () =>
      filteredRows.map((event) => {
        const workItems = event.correlation_id
          ? correlationsByEvent.get(event.correlation_id) ?? []
          : [];
        const project = getEventProject(event.payload);

        return {
          event,
          project,
          workItems,
          workItemState: event.correlation_id ? correlationQueryState : "ready",
          // Apenas contexto confirmado. Este modelo permite futuros modos de
          // agrupamento sem alterar a timeline cronológica atual.
          groupingContext: {
            huIds: workItems.map((item) => item.hu_id),
            project,
          },
        };
      }),
    [correlationQueryState, correlationsByEvent, filteredRows],
  );
  const knownHUs = useMemo(
    () => {
      const byId = new Map<string, HUCorrelation>();
      for (const correlation of huCorrelations.data ?? []) {
        if (!byId.has(correlation.hu_id)) byId.set(correlation.hu_id, correlation);
      }
      return Array.from(byId.values()).sort((a, b) => a.code.localeCompare(b.code));
    },
    [huCorrelations.data],
  );
  const selectedHU = useMemo(
    () => knownHUs.find((hu) => hu.hu_id === selectedHUId) ?? null,
    [knownHUs, selectedHUId],
  );
  const displayedTimelineEntries = useMemo(
    () =>
      timelineView === "hu" && selectedHUId
        ? timelineEntries.filter((entry) =>
            entry.groupingContext.huIds.includes(selectedHUId),
          )
        : timelineEntries,
    [selectedHUId, timelineEntries, timelineView],
  );
  const totalPages = Math.max(1, Math.ceil(displayedTimelineEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleEntries = useMemo(
    () => displayedTimelineEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [displayedTimelineEntries, safePage],
  );
  const selectedHUProjects = useMemo(
    () =>
      Array.from(
        new Set(
          displayedTimelineEntries
            .map((entry) => entry.groupingContext.project)
            .filter((project): project is string => Boolean(project)),
        ),
      ),
    [displayedTimelineEntries],
  );
  const selectedHUTimeRange = useMemo(() => {
    if (timelineView !== "hu" || !selectedHU || displayedTimelineEntries.length === 0) {
      return null;
    }

    const timestamps = displayedTimelineEntries
      .map((entry) => new Date(entry.event.received_at).getTime())
      .filter(Number.isFinite);
    if (timestamps.length === 0) return null;

    return {
      firstEventAt: new Date(Math.min(...timestamps)).toISOString(),
      lastEventAt: new Date(Math.max(...timestamps)).toISOString(),
    };
  }, [displayedTimelineEntries, selectedHU, timelineView]);
  const hasFilters =
    typeFilter !== "todos" || statusFilter !== "todos" || projectFilter !== "todos" || period !== "7d";

  const refresh = () => Promise.all([query.refetch(), kpis.refetch()]);
  const clearFilters = () => {
    setTypeFilter("todos");
    setStatusFilter("todos");
    setProjectFilter("todos");
    setPeriod("7d");
    setPage(1);
  };
  const changeTimelineView = (value: string) => {
    if (value === "general") {
      setTimelineView("general");
      setSelectedHUId(null);
      setPage(1);
      return;
    }

    setTimelineView("hu");
    setSelectedHUId(value);
    setPage(1);
  };
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (!integrationId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
        <GitBranch className="mx-auto h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-foreground">Selecione uma integração</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Escolha uma integração GitLab para acompanhar os eventos recebidos e processados.
        </p>
      </div>
    );
  }

  const summaries = [
    { label: "Recebidos no período", value: kpis.data?.total ?? 0, icon: Inbox, tone: "text-foreground" },
    { label: "Processados sem erro", value: kpis.data?.processed ?? 0, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Falhas de processamento", value: kpis.data?.errored ?? 0, icon: AlertCircle, tone: "text-rose-600" },
    { label: "Taxa de sucesso", value: `${successRate}%`, icon: CircleDot, tone: "text-blue-600" },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos eventos">
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="border-border/60 shadow-none">
            <CardContent className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                {kpis.isLoading ? (
                  <Skeleton className="mt-2 h-7 w-16" />
                ) : (
                  <p className={cn("mt-1 text-2xl font-semibold tracking-tight", tone)}>{value}</p>
                )}
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <Icon className={cn("h-4 w-4", tone)} aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-3" aria-label="Filtros de eventos">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="h-9" aria-label="Filtrar por tipo"><SelectValue placeholder="Tipo de evento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{EVENT_META[type]?.label ?? type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="h-9" aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="processado">Processado</SelectItem>
                <SelectItem value="pendente">Recebido</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(value) => { setPeriod(value as Period); setPage(1); }}>
              <SelectTrigger className="h-9" aria-label="Filtrar por período"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24 horas</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={projects.length === 0}>
              <SelectTrigger className="h-9" aria-label="Filtrar por projeto"><SelectValue placeholder="Projeto/repositório" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os projetos</SelectItem>
                {projects.map((project) => <SelectItem key={project} value={project!}>{project}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={clearFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={query.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", query.isError ? "bg-rose-500" : "bg-emerald-500")} />
          Atualização automática a cada 30 segundos
          {query.data && <span>• {filteredRows.length} evento(s) no período</span>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-label="Eventos GitLab">
        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {timelineView === "hu" ? "Fluxo por HU" : "Fluxo de eventos"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {timelineView === "hu"
                ? "Somente eventos com vínculo confirmado à HU selecionada"
                : "Mais recentes primeiro"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {query.isFetching && !query.isLoading && (
              <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando
              </span>
            )}
            <Select
              value={timelineView === "hu" && selectedHUId ? selectedHUId : "general"}
              onValueChange={changeTimelineView}
            >
              <SelectTrigger className="h-9 w-full sm:w-[260px]" aria-label="Modo da timeline">
                <SelectValue placeholder="Selecionar visão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Eventos GitLab gerais</SelectItem>
                {knownHUs.map((hu) => (
                  <SelectItem key={hu.hu_id} value={hu.hu_id}>
                    {hu.code} — {hu.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {timelineView === "hu" && (
          <div className="border-b border-border/60 bg-muted/15 px-4 py-3">
            {selectedHU ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {selectedHU.code}
                      </span>
                      <Badge variant="secondary" className="h-5 font-normal">
                        {selectedHU.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground/80" title={selectedHU.title}>
                      {selectedHU.title}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground sm:max-w-[55%] sm:text-right">
                  <p>
                    Projeto: {selectedHUProjects.length > 0
                      ? selectedHUProjects.join(", ")
                      : "indisponível nos eventos atuais"}
                  </p>
                  {selectedHUTimeRange && (
                    <dl className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-x-4">
                      <div className="flex gap-1.5 sm:justify-end">
                        <dt>Primeiro evento:</dt>
                        <dd className="font-medium text-foreground/80">
                          {formatDateTime(selectedHUTimeRange.firstEventAt)}
                        </dd>
                      </div>
                      <div className="flex gap-1.5 sm:justify-end">
                        <dt>Último evento:</dt>
                        <dd className="font-medium text-foreground/80">
                          {formatDateTime(selectedHUTimeRange.lastEventAt)}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Contexto da HU indisponível nos dados atuais.
              </div>
            )}
          </div>
        )}

        {query.isLoading ? (
          <div className="space-y-3 p-4" aria-label="Carregando eventos">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <AlertCircle className="h-9 w-9 text-rose-500" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-foreground">Não foi possível carregar os eventos</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              A navegação continua disponível. Tente atualizar esta visão em alguns instantes.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => query.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : displayedTimelineEntries.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            {timelineView === "hu" ? (
              <BookOpen className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
            ) : (
              <GitBranch className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
            )}
            <p className="mt-4 text-sm font-medium text-foreground">
              {timelineView === "hu"
                ? "Nenhum evento correlacionado a esta HU"
                : hasFilters
                  ? "Nenhum evento corresponde aos filtros"
                  : "Nenhum evento recebido ainda"}
            </p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {timelineView === "hu"
                ? "Não há vínculo confirmado entre os eventos exibidos e a HU selecionada."
                : hasFilters
                  ? "Ajuste ou limpe os filtros para ampliar a busca."
                  : "Quando os webhooks do GitLab enviarem Push Hooks, Merge Request Hooks ou outros eventos, eles aparecerão aqui."}
            </p>
            {timelineView === "general" && hasFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
           <div className="divide-y divide-border/50">
             {visibleEntries.map(({ event: row, project, workItems, workItemState }) => {
              const status = getEventStatus(row);
              const normalizedType = normalizeEventType(row.event_type, row.payload);
              const eventMeta = EVENT_META[normalizedType as GitlabEventType] ?? {
                label: normalizedType === "unknown" ? row.event_type : normalizedType,
                icon: CircleDot,
                className: "border-slate-200 bg-slate-50 text-slate-700",
              };
              const EventIcon = eventMeta.icon;
              return (
                <article
                  key={row.id}
                  className={cn(
                    "group relative border-l-2 px-3 py-3.5 transition-colors hover:bg-muted/20 sm:px-4",
                    status === "processed" && "border-l-emerald-400",
                    status === "pending" && "border-l-amber-400",
                    status === "error" && "border-l-rose-400",
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", eventMeta.className)}>
                      <EventIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        data-slot="event-primary-context"
                        className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-semibold text-foreground">{eventMeta.label}</h4>
                            {row.event_action && <Badge variant="secondary" className="h-5 font-normal">{row.event_action}</Badge>}
                          </div>
                          <p className={cn("mt-1 truncate text-sm font-medium", project ? "text-foreground/80" : "italic text-muted-foreground")} title={project ?? undefined}>
                            {project ?? "Projeto não informado"}
                          </p>
                          <WorkItemContext
                            correlations={workItems}
                            state={workItemState}
                            variant="timeline"
                          />
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div
                        data-slot="event-operational-metadata"
                        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" /> Recebido em {formatDateTime(row.received_at)}
                        </span>
                        {row.processed_at && <span className="hidden lg:inline">• Processado em {formatDateTime(row.processed_at)}</span>}
                      </div>
                      <div
                        data-slot="event-technical-context"
                        className="mt-2.5 flex flex-col gap-2 border-t border-border/40 pt-2.5 text-[11px] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                          <span>
                            Provider <span className="font-mono text-foreground/75" title={row.provider_event_id ?? undefined}>{compactId(row.provider_event_id, 20)}</span>
                          </span>
                          <span className="flex min-w-0 items-center">
                            Correlação&nbsp;<span className="max-w-[180px] truncate font-mono text-foreground/75" title={row.correlation_id ?? undefined}>{compactId(row.correlation_id, 18)}</span>
                          {row.correlation_id && (
                            <Button variant="ghost" size="icon" className="ml-0.5 h-5 w-5 shrink-0" aria-label="Copiar ID de correlação" onClick={() => copyText(row.correlation_id!)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 justify-start gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setPayloadOpen(false);
                            setViewingPayload(row);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalhes
                        </Button>
                      </div>
                      {row.processing_error && (
                        <div className="mt-3 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2">{row.processing_error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
             <span>Página {safePage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <Button variant="outline" size="sm" className="gap-1" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <Sheet
        open={!!viewingPayload}
        onOpenChange={(open) => {
          if (!open) {
            setViewingPayload(null);
            setPayloadOpen(false);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="pr-8 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle>Detalhes do evento</SheetTitle>
              {viewingPayload && <StatusBadge status={getEventStatus(viewingPayload)} />}
            </div>
            <SheetDescription>
              {viewingPayload &&
                (EVENT_META[normalizeEventType(viewingPayload.event_type, viewingPayload.payload) as GitlabEventType]?.label ??
                  viewingPayload.event_type)}
              {viewingPayload?.provider_event_id ? ` • ${viewingPayload.provider_event_id}` : ""}
              {viewingPayload ? ` • ${formatDateTime(viewingPayload.received_at)}` : ""}
            </SheetDescription>
          </SheetHeader>

          {viewingPayload && (
            <div className="mt-6 space-y-5">
              <WorkItemContext
                correlations={selectedHUCorrelations}
                state={viewingPayload.correlation_id ? correlationQueryState : "ready"}
                variant="details"
                project={getEventProject(viewingPayload.payload)}
              />

              <section aria-labelledby="event-operational-context">
                <div className="mb-2">
                  <h3 id="event-operational-context" className="text-sm font-semibold">
                    Contexto operacional
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Dados recebidos e estado de processamento
                  </p>
                </div>
              <div className="grid gap-x-4 gap-y-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Projeto/repositório</p>
                  <p className="mt-1 text-sm font-medium">{getEventProject(viewingPayload.payload) ?? "Não informado"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido em</p>
                  <p className="mt-1 text-sm font-medium">{formatDateTime(viewingPayload.received_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ação</p>
                  <p className="mt-1 text-sm font-medium">{viewingPayload.event_action ?? "Não informada"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider Event ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">
                    {viewingPayload.provider_event_id ?? "Não informado"}
                  </p>
                </div>
                {viewingPayload.processed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Processado em</p>
                    <p className="mt-1 text-sm font-medium">{formatDateTime(viewingPayload.processed_at)}</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Correlation ID</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="min-w-0 break-all font-mono text-xs text-foreground">{viewingPayload.correlation_id ?? "Não informado"}</p>
                    {viewingPayload.correlation_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyText(viewingPayload.correlation_id!)} aria-label="Copiar ID de correlação">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              </section>

              {viewingPayload.processing_error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                    <AlertCircle className="h-4 w-4" /> Erro de processamento
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-rose-700">{viewingPayload.processing_error}</p>
                </div>
              )}

              <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
                <div className="rounded-xl border border-border/70">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Detalhe técnico</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Payload original recebido pelo webhook
                    </p>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0 gap-2">
                      {payloadOpen ? "Ocultar payload" : "Ver payload"}
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", payloadOpen && "rotate-180")}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="border-t border-border/70 p-4">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      disabled={!payloadView.content}
                      onClick={() => payloadView.content && copyText(payloadView.content)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar JSON
                    </Button>
                  </div>
                {payloadView.content ? (
                  <pre className="mt-2 max-h-[58vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                    {payloadView.content}
                  </pre>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {payloadView.error ? "Payload inválido" : "Payload vazio"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {payloadView.error
                        ? "O conteúdo recebido não pôde ser formatado como JSON."
                        : "Este evento não possui conteúdo técnico para exibição."}
                    </p>
                  </div>
                )}
                </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
