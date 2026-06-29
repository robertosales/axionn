import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApfStoryList } from "./ApfStoryList";
import type { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import {
  filterAndSortApfStories,
  getApfStoryStatusCounters,
  getPageWindow,
  type ApfStatusFilter,
  type ApfStorySort,
} from "../utils/apfStoryListPagination";

type Counting = ReturnType<typeof useContractualApfCounting>;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const STATUS_OPTIONS: Array<{ value: ApfStatusFilter; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "error", label: "Com erro" },
  { value: "review", label: "Em revisão" },
  { value: "pending", label: "Pendentes" },
  { value: "analyzed", label: "Analisados" },
  { value: "counted", label: "Contados" },
  { value: "validated", label: "Validados" },
];

const SORT_OPTIONS: Array<{ value: ApfStorySort; label: string }> = [
  { value: "priority", label: "Prioridade operacional" },
  { value: "code-asc", label: "Código crescente" },
  { value: "code-desc", label: "Código decrescente" },
  { value: "pf-desc", label: "Maior PF simples" },
  { value: "pf-asc", label: "Menor PF simples" },
];

export function PaginatedApfStoryList({ counting }: { counting: Counting }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApfStatusFilter>("all");
  const [sort, setSort] = useState<ApfStorySort>("priority");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  const statusCounters = useMemo(
    () => getApfStoryStatusCounters(counting.stories),
    [counting.stories],
  );

  const filteredStories = useMemo(
    () => filterAndSortApfStories(counting.stories, search, statusFilter, sort),
    [counting.stories, search, statusFilter, sort],
  );

  const pageWindow = useMemo(
    () => getPageWindow(filteredStories.length, page, pageSize),
    [filteredStories.length, page, pageSize],
  );

  const visibleStories = useMemo(
    () => filteredStories.slice(pageWindow.start, pageWindow.end),
    [filteredStories, pageWindow.start, pageWindow.end],
  );

  useEffect(() => {
    setPage(0);
  }, [
    search,
    statusFilter,
    sort,
    pageSize,
    counting.projectId,
    counting.selectedSprintId,
  ]);

  useEffect(() => {
    if (page !== pageWindow.page) setPage(pageWindow.page);
  }, [page, pageWindow.page]);

  const visibleCounting = useMemo(
    () => ({ ...counting, stories: visibleStories }),
    [counting, visibleStories],
  );

  const applyStatus = (status: ApfStatusFilter) => {
    setStatusFilter((current) => (current === status ? "all" : status));
  };

  return (
    <>
      <div className="space-y-4 border-b p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_220px_auto] xl:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, título ou processo"
              className="pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ApfStatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {option.value !== "all"
                    ? ` (${statusCounters[option.value]})`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(value) => setSort(value as ApfStorySort)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ordenação" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="whitespace-nowrap text-sm text-muted-foreground xl:text-right">
            {filteredStories.length} de {counting.stories.length} HUs
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusChip
            label="Pendentes"
            value={statusCounters.pending}
            active={statusFilter === "pending"}
            onClick={() => applyStatus("pending")}
          />
          <StatusChip
            label="Revisar"
            value={statusCounters.review}
            tone="warning"
            active={statusFilter === "review"}
            onClick={() => applyStatus("review")}
          />
          <StatusChip
            label="Com erro"
            value={statusCounters.error}
            tone="danger"
            active={statusFilter === "error"}
            onClick={() => applyStatus("error")}
          />
          <StatusChip
            label="Contados"
            value={statusCounters.counted}
            active={statusFilter === "counted"}
            onClick={() => applyStatus("counted")}
          />
          <StatusChip
            label="Validados"
            value={statusCounters.validated}
            tone="success"
            active={statusFilter === "validated"}
            onClick={() => applyStatus("validated")}
          />
        </div>
      </div>

      <div className="[&>div:first-child]:hidden">
        <ApfStoryList counting={visibleCounting} />
      </div>

      <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {filteredStories.length === 0
            ? "Nenhuma HU para exibir"
            : `Exibindo ${pageWindow.start + 1}–${pageWindow.end} de ${filteredStories.length} HUs`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Itens por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={pageWindow.page === 0 || filteredStories.length === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="min-w-[82px] text-center text-xs tabular-nums text-muted-foreground">
            Página {pageWindow.page + 1} de {pageWindow.totalPages}
          </span>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() =>
              setPage((current) =>
                Math.min(pageWindow.totalPages - 1, current + 1),
              )
            }
            disabled={
              pageWindow.page >= pageWindow.totalPages - 1 ||
              filteredStories.length === 0
            }
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function StatusChip({
  label,
  value,
  tone = "neutral",
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : tone === "danger"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:-translate-y-px hover:shadow-sm ${toneClass} ${
        active ? "ring-2 ring-primary/30 ring-offset-1" : ""
      }`}
    >
      {label}: {value}
    </button>
  );
}
