import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Eye, ListChecks, Loader2,
  RotateCcw, Search, Sparkles,
} from "lucide-react";
import type { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import type { HuRow } from "../types/apfItem.types";
import {
  effectiveFactor,
  effectiveFunction,
  effectivePfBruto,
  effectivePfFs,
} from "../utils/contractualApf.helpers";

interface ApfStoryListProps {
  counting: ReturnType<typeof useContractualApfCounting>;
}

type StoryStatus = "pending" | "analyzed" | "review" | "counted" | "validated" | "error";
type StatusFilter = "all" | StoryStatus;

interface StoryPresentation {
  status: StoryStatus;
  statusLabel: string;
  statusClassName: string;
  typeSummary: string;
  processName: string;
  processCount: number;
  pfBruto: number | null;
  pfFs: number | null;
  hasAnalysisReview: boolean;
  hasMetricReview: boolean;
}

export function ApfStoryList({ counting }: ApfStoryListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const selectedStory = useMemo(
    () => counting.stories.find((story) => story.id === selectedStoryId) ?? null,
    [counting.stories, selectedStoryId],
  );

  const filteredStories = useMemo(() => {
    const query = normalize(search);
    return counting.stories.filter((story) => {
      const presentation = getStoryPresentation(story);
      if (statusFilter !== "all" && presentation.status !== statusFilter) return false;
      if (!query) return true;
      const processText = [
        ...story._items.map((item) => item.elementary_process_name ?? item.ef_description),
        ...(story._analysis?.processos.map((process) => process.nome_processo) ?? []),
      ].join(" ");
      return normalize(`${story.code} ${story.title} ${processText}`).includes(query);
    });
  }, [counting.stories, search, statusFilter]);

  const statusCounters = useMemo(() => counting.stories.reduce((acc, story) => {
    const status = getStoryPresentation(story).status;
    acc[status] += 1;
    return acc;
  }, {
    pending: 0,
    analyzed: 0,
    review: 0,
    counted: 0,
    validated: 0,
    error: 0,
  } as Record<StoryStatus, number>), [counting.stories]);

  if (counting.loading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_auto] lg:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, referência, título ou processo"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendentes ({statusCounters.pending})</SelectItem>
              <SelectItem value="review">Em revisão ({statusCounters.review})</SelectItem>
              <SelectItem value="counted">Contados ({statusCounters.counted})</SelectItem>
              <SelectItem value="validated">Validados ({statusCounters.validated})</SelectItem>
              <SelectItem value="analyzed">Analisados ({statusCounters.analyzed})</SelectItem>
              <SelectItem value="error">Com erro ({statusCounters.error})</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground lg:text-right">
            {filteredStories.length} de {counting.stories.length} HUs
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SummaryChip label="Pendentes" value={statusCounters.pending} />
          <SummaryChip label="Revisar" value={statusCounters.review} tone="warning" />
          <SummaryChip label="Contados" value={statusCounters.counted} />
          <SummaryChip label="Validados" value={statusCounters.validated} tone="success" />
        </div>
      </div>

      <div className="border-t">
        <div className="hidden border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[80px_minmax(0,1.7fr)_minmax(150px,1fr)_100px_90px_210px] lg:gap-4">
          <span>Código</span>
          <span>Referência funcional</span>
          <span>Processo principal</span>
          <span>Tipo / impacto</span>
          <span className="text-right">PF simples</span>
          <span className="text-right">Status e ações</span>
        </div>

        {filteredStories.length ? filteredStories.map((story) => (
          <StoryRow
            key={story.id}
            story={story}
            counting={counting}
            onDetails={() => setSelectedStoryId(story.id)}
          />
        )) : (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">Nenhuma HU encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste a busca ou o filtro de status.
            </p>
          </div>
        )}
      </div>

      <StoryDetailsDialog
        story={selectedStory}
        counting={counting}
        open={Boolean(selectedStory)}
        onOpenChange={(open) => !open && setSelectedStoryId(null)}
      />
    </>
  );
}

function StoryRow({
  story,
  counting,
  onDetails,
}: {
  story: HuRow;
  counting: ReturnType<typeof useContractualApfCounting>;
  onDetails: () => void;
}) {
  const presentation = getStoryPresentation(story);

  return (
    <article className="grid min-w-0 gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/20 lg:grid-cols-[80px_minmax(0,1.7fr)_minmax(150px,1fr)_100px_90px_210px] lg:items-center lg:gap-4">
      <div className="flex items-center justify-between gap-2 lg:block">
        <span className="font-mono text-xs font-medium">{story.code}</span>
        <div className="lg:hidden">
          <StatusBadge presentation={presentation} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={story.title}>{story.title}</p>
        <button
          type="button"
          className="mt-1 text-xs font-medium text-primary hover:underline lg:hidden"
          onClick={onDetails}
        >
          Ver detalhes da contagem
        </button>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Processo principal
        </p>
        <p className="truncate text-sm" title={presentation.processName}>
          {presentation.processName}
        </p>
        {presentation.processCount > 1 && (
          <span className="text-xs text-muted-foreground">+{presentation.processCount - 1} processo(s)</span>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Tipo / impacto
        </p>
        <Badge variant="outline" className="mt-1 max-w-full lg:mt-0">
          <span className="truncate">{presentation.typeSummary}</span>
        </Badge>
      </div>

      <div className="flex items-end justify-between gap-3 lg:block lg:text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          PF simples
        </p>
        <p className="font-semibold text-primary">
          {presentation.pfFs == null ? "—" : presentation.pfFs.toFixed(2)}
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:justify-end">
        <div className="hidden lg:block"><StatusBadge presentation={presentation} /></div>
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="outline" onClick={onDetails} className="gap-1">
            <Eye className="h-3.5 w-3.5" />
            Detalhes
          </Button>
          <PrimaryStoryAction story={story} counting={counting} />
        </div>
      </div>
    </article>
  );
}

function PrimaryStoryAction({
  story,
  counting,
}: {
  story: HuRow;
  counting: ReturnType<typeof useContractualApfCounting>;
}) {
  const presentation = getStoryPresentation(story);
  if (story._loading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (presentation.hasAnalysisReview) {
    return <Button size="sm" onClick={() => counting.openAnalysisReview(story)}>Revisar</Button>;
  }
  if (story._items.length) {
    return (
      <Button
        size="sm"
        variant={presentation.hasMetricReview ? "default" : "ghost"}
        onClick={() => counting.openValidation(story)}
      >
        {presentation.hasMetricReview ? "Resolver" : "Validar PF"}
      </Button>
    );
  }
  if (story._analysis) {
    return <Button size="sm" variant="ghost" onClick={() => counting.countForHu(story)}>Continuar</Button>;
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => counting.countForHu(story)}
      disabled={!counting.context}
    >
      <Sparkles className="mr-1 h-3.5 w-3.5" />Analisar
    </Button>
  );
}

function StoryDetailsDialog({
  story,
  counting,
  open,
  onOpenChange,
}: {
  story: HuRow | null;
  counting: ReturnType<typeof useContractualApfCounting>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!story) return null;
  const presentation = getStoryPresentation(story);
  const factor = story._items[0] ? effectiveFactor(story._items[0]) : story._analysis?.inferred_factor_sigla;
  const factorPct = counting.context?.impact_factors.find((item) => item.sigla === factor)?.contribution_pct;
  const processes = story._items.length
    ? uniqueCountedProcesses(story)
    : story._analysis?.processos ?? [];
  const factorOrigin = story._analysis?.status_reason
    ?? story._items.find((item) => item.justification)?.justification
    ?? "Origem do fator não registrada.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>{story.code}</DialogTitle>
            <StatusBadge presentation={presentation} />
          </div>
          <p className="pt-1 text-sm text-muted-foreground">{story.title}</p>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailMetric label="Tipo / impacto" value={presentation.typeSummary} />
            <DetailMetric
              label="PF bruto"
              value={presentation.pfBruto == null ? "—" : presentation.pfBruto.toFixed(2)}
            />
            <DetailMetric
              label="Fator"
              value={factor ? `${factor}${factorPct == null ? "" : ` — ${factorPct}%`}` : "—"}
            />
            <DetailMetric
              label="PF simples"
              value={presentation.pfFs == null ? "—" : presentation.pfFs.toFixed(2)}
              primary
            />
          </div>

          <section className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Origem do fator e da contagem
            </p>
            <p className="mt-2 text-sm">{factorOrigin}</p>
            {story._providerUsed && (
              <p className="mt-2 text-xs text-muted-foreground">Fonte: {story._providerUsed}</p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Processos identificados</h3>
              <Badge variant="outline">{processes.length}</Badge>
            </div>
            {processes.length ? (
              <div className="space-y-2">
                {story._items.length
                  ? uniqueCountedProcesses(story).map((item) => (
                    <div key={item.elementary_process_key ?? item.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{effectiveFunction(item)}/{effectiveFactor(item)}</Badge>
                        <ProcessDecisionBadge decision={item.counting_decision ?? "counted"} />
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {item.elementary_process_name ?? item.ef_description}
                      </p>
                      {item.process_reasoning && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.process_reasoning}</p>
                      )}
                      {item.separation_precedent_ref && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Precedente: {item.separation_precedent_ref}
                        </p>
                      )}
                    </div>
                  ))
                  : story._analysis?.processos.map((process) => (
                    <div key={process.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {process.central && <Badge variant="outline">Central</Badge>}
                        <Badge variant="outline">{process.tipo_funcional_candidato}</Badge>
                        {process.requer_validacao_humana && (
                          <Badge className="bg-amber-100 text-amber-800">Revisar</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium">{process.nome_processo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{process.justificativa_separacao}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum processo foi materializado para esta HU.
              </p>
            )}
          </section>

          {story._error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {story._error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {(story._analysis || story._items.length > 0) && (
              <RecalculateStoryButton story={story} onRecalculate={counting.recalculateHu} />
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <PrimaryStoryAction story={story} counting={counting} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getStoryPresentation(story: HuRow): StoryPresentation {
  const hasMetricReview = story._items.some((item) => item.counting_decision === "review_required");
  const hasAnalysisReview = story._analysis?.status === "review_required";
  const countedProcesses = uniqueCountedProcesses(story);
  const analysisProcesses = story._analysis?.processos ?? [];
  const processName = countedProcesses[0]?.elementary_process_name
    ?? countedProcesses[0]?.ef_description
    ?? analysisProcesses.find((process) => process.central)?.nome_processo
    ?? analysisProcesses[0]?.nome_processo
    ?? "—";
  const typeSummary = story._items.length
    ? [...new Set(story._items.map((item) => `${effectiveFunction(item)}/${effectiveFactor(item)}`))].join(" · ")
    : analysisProcesses.length
      ? [...new Set(analysisProcesses.map((process) => {
        const factor = story._analysis?.inferred_factor_sigla;
        return factor
          ? `${process.tipo_funcional_candidato}/${factor}`
          : process.tipo_funcional_candidato;
      }))].join(" · ")
      : "—";

  let status: StoryStatus = "pending";
  let statusLabel = "Pendente";
  let statusClassName = "border-muted-foreground/30 text-muted-foreground";
  if (story._error) {
    status = "error";
    statusLabel = "Erro";
    statusClassName = "border-destructive/40 bg-destructive/10 text-destructive";
  } else if (hasAnalysisReview || hasMetricReview) {
    status = "review";
    statusLabel = hasAnalysisReview ? "Revisar análise" : "Revisar contagem";
    statusClassName = "border-amber-300 bg-amber-100 text-amber-800";
  } else if (story.ai_fp_validated) {
    status = "validated";
    statusLabel = "Validado";
    statusClassName = "border-emerald-300 bg-emerald-100 text-emerald-700";
  } else if (story._items.length) {
    status = "counted";
    statusLabel = "Contado";
    statusClassName = "border-primary/20 bg-primary/5 text-foreground";
  } else if (story._analysis) {
    status = "analyzed";
    statusLabel = "Analisado";
    statusClassName = "border-sky-300 bg-sky-50 text-sky-700";
  }

  return {
    status,
    statusLabel,
    statusClassName,
    typeSummary,
    processName,
    processCount: story._items.length ? countedProcesses.length : analysisProcesses.length,
    pfBruto: story.apf_pf_bruto == null ? null : Number(story.apf_pf_bruto),
    pfFs: story.apf_pf_fs == null ? null : Number(story.apf_pf_fs),
    hasAnalysisReview,
    hasMetricReview,
  };
}

function uniqueCountedProcesses(story: HuRow) {
  return [...new Map(story._items.map((item) => [
    item.elementary_process_key ?? item.id,
    item,
  ])).values()];
}

function StatusBadge({ presentation }: { presentation: StoryPresentation }) {
  const Icon = presentation.status === "validated"
    ? CheckCircle2
    : presentation.status === "review"
      ? ListChecks
      : presentation.status === "error"
        ? AlertCircle
        : null;
  return (
    <Badge variant="outline" className={presentation.statusClassName}>
      {Icon && <Icon className="mr-1 h-3 w-3" />}
      {presentation.statusLabel}
    </Badge>
  );
}

function ProcessDecisionBadge({ decision }: { decision: "counted" | "absorbed" | "review_required" | "not_countable" }) {
  const config = {
    counted: { label: "Contado", className: "bg-emerald-100 text-emerald-700" },
    absorbed: { label: "Absorvido", className: "bg-slate-100 text-slate-700" },
    review_required: { label: "Revisar", className: "bg-amber-100 text-amber-800" },
    not_countable: { label: "Não mensurável", className: "bg-slate-100 text-slate-600" },
  } as const;
  const value = config[decision];
  return <Badge className={value.className}>{value.label}</Badge>;
}

function RecalculateStoryButton({
  story,
  onRecalculate,
}: {
  story: HuRow;
  onRecalculate: (story: HuRow) => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title="Gerar nova análise de processos e preservar o histórico anterior"
      onClick={() => {
        const confirmed = window.confirm(
          `Reanalisar ${story.code}? A análise e a contagem atuais serão preservadas no histórico.`,
        );
        if (confirmed) onRecalculate(story);
      }}
    >
      <RotateCcw className="mr-1 h-3.5 w-3.5" />Reanalisar
    </Button>
  );
}

function DetailMetric({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${primary ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success";
}) {
  const className = tone === "warning"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "bg-muted/40 text-muted-foreground";
  return <Badge variant="outline" className={className}>{label}: {value}</Badge>;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
