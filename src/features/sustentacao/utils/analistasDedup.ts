/**
 * Builds one option per technical user id. Duplicate relationship/profile rows
 * collapse by user_id; equal names belonging to different users remain distinct.
 */
export interface AnalistaOption {
  user_id: string;
  display_name: string;
}

export function buildAnalistasDedup(
  ids: string[],
  profiles: Array<{ user_id: string; display_name: string }>,
): AnalistaOption[] {
  const profileByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const byUser = new Map<string, AnalistaOption>();
  ids.forEach((id) => {
    if (!id || byUser.has(id)) return;
    const p = profileByUser.get(id);
    const display = (p?.display_name || id.slice(0, 8)).trim();
    byUser.set(id, { user_id: id, display_name: display });
  });
  return [...byUser.values()]
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));
}

export function analistaMatches(filterValue: string, userId: string | null | undefined): boolean {
  if (!filterValue || filterValue === "all") return true;
  if (!userId) return false;
  return filterValue === userId;
}
