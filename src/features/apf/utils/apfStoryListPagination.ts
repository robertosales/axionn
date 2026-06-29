import type { HuRow } from "../types/apfItem.types";

export type ApfStoryStatus = "pending" | "analyzed" | "review" | "counted" | "validated" | "error";
export type ApfStatusFilter = "all" | ApfStoryStatus;
export type ApfStorySort = "priority" | "code-asc" | "code-desc" | "pf-desc" | "pf-asc";

const PRIORITY: Record<ApfStoryStatus, number> = {
  error: 0,
  review: 1,
  pending: 2,
  analyzed: 3,
  counted: 4,
  validated: 5,
};

export function getApfStoryStatus(story: HuRow): ApfStoryStatus {
  const metricReview = story._items.some((item) => item.counting_decision === "review_required");
  const analysisReview = story._analysis?.status === "review_required";
  if (story._error) return "error";
  if (analysisReview || metricReview) return "review";
  if (story.ai_fp_validated) return "validated";
  if (story._items.length > 0) return "counted";
  if (story._analysis) return "analyzed";
  return "pending";
}

export function getApfStoryPf(story: HuRow) {
  return Number(story.apf_pf_fs ?? story.function_points ?? 0);
}

export function filterAndSortApfStories(
  stories: HuRow[],
  search: string,
  statusFilter: ApfStatusFilter,
  sort: ApfStorySort,
) {
  const query = normalize(search);
  return stories
    .filter((story) => {
      if (statusFilter !== "all" && getApfStoryStatus(story) !== statusFilter) return false;
      if (!query) return true;
      const processes = [
        ...story._items.map((item) => item.elementary_process_name ?? item.ef_description),
        ...(story._analysis?.processos.map((process) => process.nome_processo) ?? []),
      ].join(" ");
      return normalize(`${story.code} ${story.title} ${story.description ?? ""} ${processes}`).includes(query);
    })
    .sort((left, right) => {
      if (sort === "code-asc") return compareCode(left, right);
      if (sort === "code-desc") return compareCode(right, left);
      if (sort === "pf-desc") return getApfStoryPf(right) - getApfStoryPf(left) || compareCode(left, right);
      if (sort === "pf-asc") return getApfStoryPf(left) - getApfStoryPf(right) || compareCode(left, right);
      return PRIORITY[getApfStoryStatus(left)] - PRIORITY[getApfStoryStatus(right)] || compareCode(left, right);
    });
}

export function getApfStoryStatusCounters(stories: HuRow[]) {
  return stories.reduce((result, story) => {
    result[getApfStoryStatus(story)] += 1;
    return result;
  }, {
    pending: 0,
    analyzed: 0,
    review: 0,
    counted: 0,
    validated: 0,
    error: 0,
  } as Record<ApfStoryStatus, number>);
}

export function getPageWindow(total: number, requestedPage: number, requestedPageSize: number) {
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), totalPages - 1);
  const start = total === 0 ? 0 : page * pageSize;
  const end = Math.min(start + pageSize, total);
  return { page, pageSize, total, totalPages, start, end };
}

function compareCode(left: HuRow, right: HuRow) {
  return left.code.localeCompare(right.code, "pt-BR", { numeric: true, sensitivity: "base" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
