import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertSafeOutboundUrl, hostsFromEnv } from '../_shared/outbound-url.ts';
import { readTextBody } from '../_shared/request-body.ts';

const MAX_BODY_BYTES = 1_000_000;
const MAX_BULK_PROJECTS = 50;
const MAX_BULK_PAGES_PER_PROJECT = 100;
const PAGE_SIZE = 100;
const ALLOWED_EVENTS = new Set(['issue_created', 'issue_updated', 'issues_bulk']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-id, x-redmine-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RedmineIssue {
  id: number;
  project: { id: number; name?: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority?: { id: number; name: string };
  author?: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  subject: string;
  description?: string;
  estimated_hours?: number;
  created_on: string;
  updated_on: string;
  closed_on?: string;
}

interface RedmineScope { projectId: string; teamId: string }

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  let healthContext: any = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const integrationId = req.headers.get('x-integration-id');
    if (!integrationId) return json(400, { error: 'Missing x-integration-id header' });

    const { data: integration, error: integrationError } = await supabase
      .from('redmine_integrations').select('*').eq('id', integrationId).single();
    if (integrationError || !integration) {
      return json(409, { error: 'Integration not found', error_code: 'INTEGRATION_NOT_FOUND', correlation_id: correlationId });
    }

    healthContext = {
      supabase,
      organizationId: integration.organization_id,
      projectId: integration.project_id ?? null,
      integrationId,
    };
    if (!integration.is_active) {
      await recordRedmineHealth(healthContext, {
        status: 'degraded', latencyMs: Date.now() - startTime, correlationId,
        errorCode: 'INTEGRATION_INACTIVE', errorMessage: 'Redmine integration is inactive',
      });
      return json(409, { error: 'Integration is inactive' });
    }

    const providedSecret = req.headers.get('x-redmine-api-key');
    if (!integration.webhook_secret_encrypted) return json(503, { error: 'Webhook authentication is not configured' });
    if (!providedSecret) return json(401, { error: 'Missing webhook signature' });
    if (!(await constantTimeEqual(providedSecret, integration.webhook_secret_encrypted))) {
      return json(401, { error: 'Invalid webhook signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(await readTextBody(req, MAX_BODY_BYTES));
    } catch {
      return json(400, { error: 'Invalid webhook payload' });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !ALLOWED_EVENTS.has(payload.event_type)) {
      return json(400, { error: 'Unsupported or missing event_type' });
    }
    const eventType = payload.event_type as string;
    if (eventType !== 'issues_bulk') assertValidIssue(payload.issue);

    let issuesProcessed = 0;
    let issuesCreated = 0;
    let issuesUpdated = 0;
    let issuesSkipped = 0;
    let issuesFailed = 0;

    await requireRpc(supabase, 'log_redmine_sync_event', {
      p_integration_id: integrationId,
      p_organization_id: integration.organization_id,
      p_sync_type: eventType === 'issues_bulk' ? 'bulk' : 'webhook',
      p_trigger_source: eventType === 'issues_bulk' ? 'schedule' : 'webhook',
      p_status: 'started', p_correlation_id: correlationId,
    });

    if (eventType === 'issue_updated' || eventType === 'issue_created') {
      const result = await processIssue(supabase, integration, payload.issue, correlationId);
      issuesProcessed = 1;
      if (result.action === 'created') issuesCreated = 1;
      else if (result.action === 'updated') issuesUpdated = 1;
      else issuesSkipped = 1;
    } else {
      const result = await bulkSyncIssues(supabase, integration, correlationId);
      ({ processed: issuesProcessed, created: issuesCreated, updated: issuesUpdated,
        skipped: issuesSkipped, failed: issuesFailed } = result);
    }

    const completedWithErrors = issuesFailed > 0;
    const { error: integrationUpdateError } = await supabase.from('redmine_integrations').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: completedWithErrors ? 'partial' : 'success',
      last_sync_items: issuesProcessed,
      last_sync_error: completedWithErrors ? `${issuesFailed} item(ns) failed during synchronization` : null,
    }).eq('id', integrationId).eq('organization_id', integration.organization_id);
    if (integrationUpdateError) throw integrationUpdateError;

    await recordRedmineHealth(healthContext, {
      status: completedWithErrors ? 'degraded' : 'healthy',
      latencyMs: Date.now() - startTime, correlationId,
      errorCode: completedWithErrors ? 'PARTIAL_SYNC' : undefined,
      errorMessage: completedWithErrors ? `${issuesFailed} item(ns) failed during synchronization` : undefined,
      details: { event_type: eventType, processed: issuesProcessed, created: issuesCreated,
        updated: issuesUpdated, skipped: issuesSkipped, failed: issuesFailed },
    });
    await requireRpc(supabase, 'log_redmine_sync_event', {
      p_integration_id: integrationId, p_organization_id: integration.organization_id,
      p_sync_type: eventType === 'issues_bulk' ? 'bulk' : 'webhook',
      p_trigger_source: eventType === 'issues_bulk' ? 'schedule' : 'webhook',
      p_status: completedWithErrors ? 'partial' : 'completed',
      p_issues_processed: issuesProcessed, p_issues_created: issuesCreated,
      p_issues_updated: issuesUpdated, p_issues_skipped: issuesSkipped,
      p_issues_failed: issuesFailed, p_correlation_id: correlationId,
    });

    return json(200, { success: true, correlation_id: correlationId, processed: issuesProcessed,
      created: issuesCreated, updated: issuesUpdated, skipped: issuesSkipped, failed: issuesFailed });
  } catch (error) {
    console.error('[Redmine Sync] Error:', error);
    const safeError = error instanceof Error ? error.message.slice(0, 500) : 'Unknown synchronization error';
    if (healthContext) {
      await healthContext.supabase.from('redmine_integrations').update({
        last_sync_at: new Date().toISOString(), last_sync_status: 'failed', last_sync_error: safeError,
      }).eq('id', healthContext.integrationId).eq('organization_id', healthContext.organizationId);
      await recordRedmineHealth(healthContext, {
        status: 'unhealthy', latencyMs: Date.now() - startTime, correlationId,
        errorCode: 'SYNC_FAILED', errorMessage: safeError,
      });
      await healthContext.supabase.rpc('log_redmine_sync_event', {
        p_integration_id: healthContext.integrationId, p_organization_id: healthContext.organizationId,
        p_sync_type: 'webhook', p_trigger_source: 'webhook', p_status: 'failed',
        p_issues_failed: 1, p_error_details: { error: safeError }, p_correlation_id: correlationId,
      });
    }
    return json(500, { error: 'Internal server error', correlation_id: correlationId });
  }
});

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(right), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(left));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(right));
}

function assertValidIssue(value: unknown): asserts value is RedmineIssue {
  const issue = value as any;
  const validDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  if (!issue || typeof issue !== 'object' || !Number.isSafeInteger(issue.id) || issue.id <= 0 ||
      !Number.isSafeInteger(issue.project?.id) || issue.project.id <= 0 ||
      !Number.isSafeInteger(issue.tracker?.id) || typeof issue.tracker?.name !== 'string' ||
      !Number.isSafeInteger(issue.status?.id) || typeof issue.status?.name !== 'string' ||
      typeof issue.subject !== 'string' || issue.subject.trim().length === 0 || issue.subject.length > 500 ||
      (issue.description != null && (typeof issue.description !== 'string' || issue.description.length > 100_000)) ||
      !validDate(issue.created_on) || !validDate(issue.updated_on)) {
    throw new Error('INVALID_REDMINE_ISSUE');
  }
}

async function resolveScope(supabase: any, integration: any, issue: RedmineIssue): Promise<RedmineScope> {
  const mappings = Array.isArray(integration.project_mappings) ? integration.project_mappings : [];
  const mapping = mappings.find((item: any) =>
    Number(item?.redmine_project_id) === issue.project.id && typeof item?.axionn_project_id === 'string');
  const projectId = mapping?.axionn_project_id ?? integration.project_id;
  if (!projectId) throw new Error('REDMINE_PROJECT_MAPPING_REQUIRED');

  const { data: project, error } = await supabase.from('projects').select('id, team_id')
    .eq('id', projectId).eq('org_id', integration.organization_id).maybeSingle();
  if (error) throw error;
  if (!project?.team_id) throw new Error('REDMINE_PROJECT_OUT_OF_SCOPE');
  return { projectId: project.id, teamId: project.team_id };
}

async function processIssue(supabase: any, integration: any, issue: RedmineIssue, correlationId: string) {
  assertValidIssue(issue);
  const scope = await resolveScope(supabase, integration, issue);
  const trackerName = issue.tracker.name;
  const entityType = integration.tracker_mappings?.[trackerName] ?? 'user_story';
  if (entityType !== 'user_story') throw new Error('REDMINE_ENTITY_TYPE_NOT_IMPLEMENTED');

  const { data: existingLink, error: linkReadError } = await supabase.from('redmine_issue_links').select('*')
    .eq('integration_id', integration.id).eq('organization_id', integration.organization_id)
    .eq('redmine_issue_id', issue.id).maybeSingle();
  if (linkReadError) throw linkReadError;

  const statusName = issue.status.name;
  const status = integration.status_mappings?.[statusName] ?? mapDefaultStatus(statusName);
  const priorityName = issue.priority?.name ?? 'Normal';
  const priority = integration.priority_mappings?.[priorityName] ?? priorityName.toLowerCase();

  if (existingLink) {
    if (existingLink.axionn_entity_type !== 'user_story') throw new Error('REDMINE_LINK_ENTITY_TYPE_MISMATCH');
    const { data: updated, error } = await supabase.from('user_stories').update({
      title: issue.subject.trim(), description: issue.description ?? '', status, priority,
      ...(Number.isFinite(issue.estimated_hours) ? { story_points: issue.estimated_hours } : {}),
    }).eq('id', existingLink.axionn_entity_id).eq('team_id', scope.teamId).select('id').maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error('REDMINE_LINK_TARGET_OUT_OF_SCOPE');
    await updateLink(supabase, existingLink.id, integration, issue);
    return { action: 'updated' };
  }

  if (integration.sync_direction === 'axionn_to_redmine') return { action: 'skipped' };
  const { data: created, error: createError } = await supabase.from('user_stories').insert({
    team_id: scope.teamId, code: `RM-${issue.id}`, title: issue.subject.trim(),
    description: issue.description ?? '', status, priority,
    story_points: Number.isFinite(issue.estimated_hours) ? issue.estimated_hours : 0,
  }).select('id').single();
  if (createError) throw createError;
  await createLink(supabase, integration, issue, created.id, correlationId);
  return { action: 'created' };
}

function mapDefaultStatus(status: string): string {
  return ({ New: 'todo', 'In Progress': 'in_progress', Resolved: 'done', Closed: 'done',
    Rejected: 'cancelled', Feedback: 'in_review' } as Record<string, string>)[status] ?? 'todo';
}

async function createLink(supabase: any, integration: any, issue: RedmineIssue, entityId: string, _correlationId: string) {
  const { error } = await supabase.from('redmine_issue_links').insert({
    integration_id: integration.id, organization_id: integration.organization_id,
    redmine_issue_id: issue.id, redmine_project_id: issue.project.id,
    redmine_tracker_id: issue.tracker.id, redmine_status_id: issue.status.id,
    redmine_priority_id: issue.priority?.id ?? null, axionn_entity_type: 'user_story',
    axionn_entity_id: entityId, sync_direction: 'redmine_to_axionn',
    last_synced_at: new Date().toISOString(), last_redmine_updated_on: new Date(issue.updated_on).toISOString(),
    sync_status: 'synced',
  });
  if (error) throw error;
}

async function updateLink(supabase: any, linkId: string, integration: any, issue: RedmineIssue) {
  const { data, error } = await supabase.from('redmine_issue_links').update({
    redmine_project_id: issue.project.id, redmine_tracker_id: issue.tracker.id,
    redmine_status_id: issue.status.id, redmine_priority_id: issue.priority?.id ?? null,
    last_synced_at: new Date().toISOString(), last_redmine_updated_on: new Date(issue.updated_on).toISOString(),
    sync_status: 'synced',
  }).eq('id', linkId).eq('integration_id', integration.id)
    .eq('organization_id', integration.organization_id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('REDMINE_LINK_OUT_OF_SCOPE');
}

async function bulkSyncIssues(supabase: any, integration: any, correlationId: string) {
  let processed = 0, created = 0, updated = 0, skipped = 0, failed = 0;
  const baseUrl = assertSafeOutboundUrl(integration.base_url, {
    allowedHosts: hostsFromEnv('REDMINE_ALLOWED_HOSTS'),
  }).href.replace(/\/$/, '');
  if (!integration.api_key_encrypted) throw new Error('REDMINE_API_KEY_NOT_CONFIGURED');
  const rawProjectIds = integration.sync_filter_json?.project_ids;
  const projectIds = Array.isArray(rawProjectIds) ? rawProjectIds.slice(0, MAX_BULK_PROJECTS) : [];
  if (projectIds.length === 0) throw new Error('REDMINE_BULK_PROJECTS_REQUIRED');
  if (rawProjectIds.length > MAX_BULK_PROJECTS) throw new Error('REDMINE_BULK_PROJECT_LIMIT_EXCEEDED');

  for (const projectId of projectIds) {
    if (!Number.isSafeInteger(Number(projectId)) || Number(projectId) <= 0) throw new Error('INVALID_REDMINE_PROJECT_ID');
    for (let page = 0; page < MAX_BULK_PAGES_PER_PROJECT; page++) {
      const url = `${baseUrl}/issues.json?project_id=${encodeURIComponent(String(projectId))}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&sort=updated_on:desc`;
      const response = await fetch(url, { headers: { 'X-Redmine-API-Key': integration.api_key_encrypted, Accept: 'application/json' } });
      if (!response.ok) throw new Error(`REDMINE_API_${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body?.issues) || body.issues.length > PAGE_SIZE) throw new Error('INVALID_REDMINE_API_RESPONSE');
      for (const issue of body.issues) {
        try {
          assertValidIssue(issue);
          const result = await processIssue(supabase, integration, issue, correlationId);
          processed++;
          if (result.action === 'created') created++;
          else if (result.action === 'updated') updated++;
          else skipped++;
        } catch (error) {
          failed++;
          console.error('[Redmine Sync] Issue failed:', issue?.id, error);
        }
      }
      if (body.issues.length < PAGE_SIZE) break;
      if (page === MAX_BULK_PAGES_PER_PROJECT - 1) throw new Error('REDMINE_BULK_PAGE_LIMIT_EXCEEDED');
    }
  }
  return { processed, created, updated, skipped, failed };
}

async function requireRpc(supabase: any, name: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
}

async function recordRedmineHealth(context: any, event: any): Promise<void> {
  const { error } = await context.supabase.from('integration_health_events').insert({
    organization_id: context.organizationId, project_id: context.projectId,
    provider: 'redmine', integration_id: context.integrationId, check_type: 'sync',
    status: event.status, latency_ms: event.latencyMs, error_code: event.errorCode ?? null,
    error_message: event.errorMessage?.slice(0, 500) ?? null, details: event.details ?? {},
    correlation_id: event.correlationId,
  });
  if (error) console.error('[Redmine Sync] Failed to record integration health:', error);
}
