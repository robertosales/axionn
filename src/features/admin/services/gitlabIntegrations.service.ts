import { supabase } from "@/integrations/supabase/client";

export interface GitlabIntegration {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  repositoryPath: string | null;
  repositoryName: string | null;
  apiUrl: string | null;
  accessToken: string | null;
  hasAccessToken: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookId: string | null;
  events: string[];
  isActive: boolean;
  syncStatus: string | null;
  syncError: string | null;
  teamId: string | null;
  syncIssuesAsBacklog: boolean;
  issueLabelsTeamMap: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface GitlabIntegrationPayload {
  organization_id: string;
  project_id?: string | null;
  name: string;
  provider: string;
  base_url: string;
  repository_path: string | null;
  repository_name: string | null;
  api_url: string | null;
  access_token_encrypted: string | null;
  webhook_url: string | null;
  webhook_secret_encrypted: string | null;
  events: string[];
  is_active: boolean;
  sync_status?: string | null;
  sync_error?: string | null;
  team_id?: string | null;
  sync_issues_as_backlog?: boolean;
  issue_labels_team_map?: Record<string, string>;
}

export interface GitlabIntegrationValidationResult {
  ok: boolean;
  errors: string[];
}

export function normalizeGitlabIntegration(row: Record<string, unknown>): GitlabIntegration {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "GitLab"),
    provider: String(row.provider ?? "gitlab"),
    baseUrl: String(row.base_url ?? ""),
    repositoryPath: row.repository_path ? String(row.repository_path) : null,
    repositoryName: row.repository_name ? String(row.repository_name) : null,
    apiUrl: row.api_url ? String(row.api_url) : null,
    // Do not copy credentials back into an editable form. Keep only the
    // presence flag so updates can preserve the stored PAT.
    accessToken: null,
    hasAccessToken: Boolean(row.access_token_encrypted),
    webhookUrl: row.webhook_url ? String(row.webhook_url) : null,
    webhookSecret: null,
    webhookId: row.webhook_id ? String(row.webhook_id) : null,
    events: Array.isArray(row.events) ? (row.events as string[]) : ["push", "merge_request"],
    isActive: Boolean(row.is_active),
    teamId: row.team_id ? String(row.team_id) : null,
    syncIssuesAsBacklog: row.sync_issues_as_backlog != null ? Boolean(row.sync_issues_as_backlog) : true,
    issueLabelsTeamMap:
      row.issue_labels_team_map && typeof row.issue_labels_team_map === "object"
        ? (row.issue_labels_team_map as Record<string, string>)
        : {},
    syncStatus: row.sync_status ? String(row.sync_status) : null,
    syncError: row.sync_error ? String(row.sync_error) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function buildGitlabIntegrationPayload(input: {
  organizationId: string;
  projectId?: string | null;
  name: string;
  baseUrl: string;
  repositoryPath: string;
  repositoryName?: string | null;
  apiUrl?: string | null;
  accessToken?: string | null;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  events?: string[];
  isActive?: boolean;
  teamId?: string | null;
  syncIssuesAsBacklog?: boolean;
  issueLabelsTeamMap?: Record<string, string>;
}): GitlabIntegrationPayload {
  return {
    organization_id: input.organizationId,
    project_id: input.projectId ?? null,
    name: input.name.trim(),
    provider: "gitlab",
    base_url: input.baseUrl.trim(),
    repository_path: input.repositoryPath.trim() || null,
    repository_name: input.repositoryName?.trim() || null,
    api_url: input.apiUrl?.trim() || null,
    access_token_encrypted: input.accessToken?.trim() || null,
    webhook_url: input.webhookUrl?.trim() || null,
    webhook_secret_encrypted: input.webhookSecret?.trim() || null,
    events: input.events ?? ["push", "merge_request"],
    is_active: input.isActive ?? true,
    sync_status: "pending",
    sync_error: null,
    team_id: input.teamId ?? null,
    sync_issues_as_backlog: input.syncIssuesAsBacklog ?? true,
    issue_labels_team_map: input.issueLabelsTeamMap ?? {},
  };
}

export function validateGitlabIntegrationPayload(input: {
  name: string;
  baseUrl: string;
  repositoryPath: string;
  repositoryName?: string | null;
  apiUrl?: string | null;
  accessToken?: string | null;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  isActive?: boolean;
}): GitlabIntegrationValidationResult {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name");
  if (!input.baseUrl.trim()) errors.push("baseUrl");
  if (!input.repositoryPath.trim()) errors.push("repositoryPath");

  return { ok: errors.length === 0, errors };
}

export async function listGitlabIntegrations(organizationId: string): Promise<GitlabIntegration[]> {
  const { data, error } = await (supabase as any)
    .from("git_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "gitlab")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeGitlabIntegration(row as Record<string, unknown>));
}

export async function createGitlabIntegration(payload: GitlabIntegrationPayload): Promise<GitlabIntegration> {
  const { data, error } = await (supabase as any)
    .from("git_integrations")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeGitlabIntegration(data as Record<string, unknown>);
}

export async function updateGitlabIntegration(id: string, patch: Partial<GitlabIntegrationPayload>): Promise<GitlabIntegration> {
  const { data, error } = await (supabase as any)
    .from("git_integrations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeGitlabIntegration(data as Record<string, unknown>);
}

export async function deleteGitlabIntegration(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("git_integrations")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
