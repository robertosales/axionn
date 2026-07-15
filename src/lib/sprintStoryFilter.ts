export interface SprintStoryLike {
  sprintId: string | null;
}

export function resolveBacklogSprintId(
  selectedSprintId: string | null | undefined,
  activeSprintId: string | null | undefined,
): string | null {
  return selectedSprintId || activeSprintId || null;
}

export function filterStoriesBySprint<T extends SprintStoryLike>(stories: T[], sprintId: string | null): T[] {
  if (!sprintId) return [];
  return stories.filter((story) => story.sprintId === sprintId);
}

