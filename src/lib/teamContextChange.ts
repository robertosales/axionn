import { queryClient } from "@/lib/queryClient";

export const TEAM_DEPENDENT_SESSION_KEYS = [
  "metricas:filters",
  "kanban_board_filtros",
  "kanban_board_expanded_cols",
] as const;

export const TEAM_DEPENDENT_QUERY_PARAMS = [
  "teamId", "memberId", "analystId", "sprintId", "releaseId",
  "assigneeId", "statusId", "projectId", "page", "startDate",
  "endDate", "search",
] as const;

export function clearTeamDependentBrowserState(): void {
  if (typeof window === "undefined") return;
  TEAM_DEPENDENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));

  const url = new URL(window.location.href);
  let changed = false;
  TEAM_DEPENDENT_QUERY_PARAMS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (changed) window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function beginTeamContextChange(previousTeamId: string, nextTeamId: string | null): void {
  if (previousTeamId === nextTeamId) return;
  clearTeamDependentBrowserState();
  void queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey.some((part) => part === previousTeamId),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("axionn:team-context-changed", {
      detail: { previousTeamId, nextTeamId },
    }));
  }
}
