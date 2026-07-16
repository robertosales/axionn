export interface DeveloperIdentityRecord {
  id: string;
  name: string;
  role?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  email?: string | null;
}

export type CanonicalDeveloper<T extends DeveloperIdentityRecord> = T & { aliasIds: string[] };

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function nameSignature(name: string): string {
  const parts = normalize(name).match(/[a-z0-9]+/g) ?? [];
  return parts.length > 1 ? `${parts[0]}:${parts[parts.length - 1]}` : parts[0] ?? "";
}

function identityKeys(record: DeveloperIdentityRecord): string[] {
  const keys: string[] = [];
  if (record.user_id) keys.push(`user:${record.user_id}`);
  if (record.email) keys.push(`email:${normalize(record.email)}`);
  const signature = nameSignature(record.name);
  if (signature) keys.push(`name:${signature}:role:${normalize(record.role)}`);
  return keys;
}

function preferredRecord<T extends DeveloperIdentityRecord>(current: T, candidate: T): T {
  const currentLength = normalize(current.name).length;
  const candidateLength = normalize(candidate.name).length;
  if (candidateLength !== currentLength) return candidateLength > currentLength ? candidate : current;
  return new Date(candidate.created_at ?? 0) > new Date(current.created_at ?? 0) ? candidate : current;
}

/** One visual option per person, retaining every persisted developer id as an alias. */
export function canonicalizeDevelopers<T extends DeveloperIdentityRecord>(records: T[]): CanonicalDeveloper<T>[] {
  const groups: Array<{ record: T; aliasIds: Set<string>; keys: Set<string> }> = [];
  for (const record of records ?? []) {
    const keys = identityKeys(record);
    const group = groups.find((item) => keys.some((key) => item.keys.has(key)));
    if (!group) {
      groups.push({ record, aliasIds: new Set([record.id]), keys: new Set(keys) });
      continue;
    }
    group.record = preferredRecord(group.record, record);
    group.aliasIds.add(record.id);
    keys.forEach((key) => group.keys.add(key));
  }
  return groups
    .map(({ record, aliasIds }) => ({ ...record, aliasIds: [...aliasIds] }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export function developerIdMatches(developer: { id: string; aliasIds?: string[] }, persistedId: string | null | undefined): boolean {
  return Boolean(persistedId && (developer.id === persistedId || developer.aliasIds?.includes(persistedId)));
}
