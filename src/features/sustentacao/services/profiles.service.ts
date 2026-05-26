import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  user_id: string;
  display_name: string;
  email?: string;
}

/** Fetch a single profile's display_name by profiles.id (NOT user_id). */
export async function fetchProfileDisplayNameById(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .single();
  return (data as any)?.display_name ?? null;
}

/** Fetch display_name + email for a list of user_ids. Returns a Map. */
export async function fetchProfilesByUserIds(
  userIds: string[],
): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  if (userIds.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, email")
    .in("user_id", userIds);
  (data ?? []).forEach((p: any) => {
    map.set(p.user_id, {
      user_id: p.user_id,
      display_name: p.display_name,
      email: p.email,
    });
  });
  return map;
}

/**
 * Fallback to developers table when profile is unavailable (e.g. RLS).
 * Looks up by user_id OR by developers.id.
 */
export async function fetchDevelopersFallback(
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const filter = ids.join(",");
  const { data } = await supabase
    .from("developers")
    .select("user_id, id, name")
    .or(`user_id.in.(${filter}),id.in.(${filter})`);
  (data ?? []).forEach((d: any) => {
    if (d.user_id) map.set(d.user_id, d.name);
    if (d.id) map.set(d.id, d.name);
  });
  return map;
}

/**
 * Fetch responsible user_ids for a list of demanda_ids.
 * Returns Map<demanda_id, user_id[]>.
 */
export async function fetchResponsaveisByDemandaIds(
  demandaIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (demandaIds.length === 0) return map;
  const { data, error } = await supabase
    .from("demanda_responsaveis")
    .select("demanda_id, user_id")
    .in("demanda_id", demandaIds);
  if (error || !data) return map;
  (data as any[]).forEach((r) => {
    const list = map.get(r.demanda_id) ?? [];
    list.push(r.user_id);
    map.set(r.demanda_id, list);
  });
  return map;
}

/** Search profiles by display_name (ilike). Returns up to `limit` rows. */
export async function searchProfilesByName(
  query: string,
  limit = 5,
): Promise<Array<{ id: string; user_id: string; display_name: string }>> {
  if (!query || query.length < 2) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, user_id, display_name")
    .ilike("display_name", `%${query}%`)
    .limit(limit);
  return (data ?? []) as any[];
}

/**
 * Fetch responsáveis enriched with papel + display_name, grouped by demanda_id.
 */
export async function fetchResponsaveisWithPapelByDemandaIds(
  demandaIds: string[],
): Promise<Map<string, { papel: string; display_name: string }[]>> {
  const map = new Map<string, { papel: string; display_name: string }[]>();
  if (demandaIds.length === 0) return map;
  const { data: respData, error } = await supabase
    .from("demanda_responsaveis")
    .select("demanda_id, papel, user_id")
    .in("demanda_id", demandaIds);
  if (error || !respData?.length) return map;
  const userIds = [...new Set((respData as any[]).map((r) => r.user_id))];
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  const profilesMap = new Map<string, string>();
  (profilesData ?? []).forEach((p: any) => profilesMap.set(p.user_id, p.display_name));
  (respData as any[]).forEach((r) => {
    const nome = profilesMap.get(r.user_id);
    if (!nome) return;
    const lista = map.get(r.demanda_id) ?? [];
    lista.push({ papel: r.papel, display_name: nome });
    map.set(r.demanda_id, lista);
  });
  return map;
}