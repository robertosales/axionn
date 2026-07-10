import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-redmine-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RedmineIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  subject: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  spent_hours?: number;
  created_on: string;
  updated_on: string;
  closed_on?: string;
  custom_fields?: Array<{ id: number; name: string; value: string }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const integrationId = req.headers.get('x-integration-id');
    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'Missing x-integration-id header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration config
    const { data: integration, error: integrationError } = await supabase
      .from('redmine_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const organizationId = integration.organization_id;

    // Verify webhook signature
    const signature = req.headers.get('x-redmine-api-key');
    if (integration.webhook_secret_encrypted && signature) {
      // In production, decrypt and verify
      const isValid = signature === integration.webhook_secret_encrypted; // Placeholder
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    const payload = await req.json();
    const eventType = payload.event_type || 'unknown';

    // Log sync event start
    await supabase.rpc('log_redmine_sync_event', {
      p_integration_id: integrationId,
      p_organization_id: organizationId,
      p_sync_type: 'webhook',
      p_trigger_source: 'webhook',
      p_status: 'started',
      p_correlation_id: correlationId,
    });

    let issuesProcessed = 0;
    let issuesCreated = 0;
    let issuesUpdated = 0;
    let issuesSkipped = 0;
    let issuesFailed = 0;

    // Handle different webhook events
    if (eventType === 'issue_updated' || eventType === 'issue_created') {
      const issue = payload.issue as RedmineIssue;
      const result = await processIssue(supabase, integration, issue, correlationId);
      issuesProcessed++;
      if (result.action === 'created') issuesCreated++;
      else if (result.action === 'updated') issuesUpdated++;
      else issuesSkipped++;
    } else if (eventType === 'issues_bulk') {
      // Bulk sync from schedule
      const result = await bulkSyncIssues(supabase, integration, correlationId);
      issuesProcessed = result.processed;
      issuesCreated = result.created;
      issuesUpdated = result.updated;
      issuesSkipped = result.skipped;
      issuesFailed = result.failed;
    }

    // Log completion
    await supabase.rpc('log_redmine_sync_event', {
      p_integration_id: integrationId,
      p_organization_id: organizationId,
      p_sync_type: 'webhook',
      p_trigger_source: 'webhook',
      p_status: issuesFailed > 0 ? 'partial' : 'completed',
      p_issues_processed: issuesProcessed,
      p_issues_created: issuesCreated,
      p_issues_updated: issuesUpdated,
      p_issues_skipped: issuesSkipped,
      p_issues_failed: issuesFailed,
      p_correlation_id: correlationId,
    });

    return new Response(JSON.stringify({
      success: true,
      correlation_id: correlationId,
      processed: issuesProcessed,
      created: issuesCreated,
      updated: issuesUpdated,
      skipped: issuesSkipped,
      failed: issuesFailed,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Redmine Sync] Error:', error);

    // Log failure
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const integrationId = req.headers.get('x-integration-id');
    if (integrationId) {
      const { data: integration } = await supabase
        .from('redmine_integrations')
        .select('organization_id')
        .eq('id', integrationId)
        .single();

      if (integration) {
        await supabase.rpc('log_redmine_sync_event', {
          p_integration_id: integrationId,
          p_organization_id: integration.organization_id,
          p_sync_type: 'webhook',
          p_trigger_source: 'webhook',
          p_status: 'failed',
          p_issues_failed: 1,
          p_error_details: { error: error.message },
          p_correlation_id: correlationId,
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Internal server error',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processIssue(
  supabase: any,
  integration: any,
  issue: RedmineIssue,
  correlationId: string
): Promise<{ action: string }> {
  // Find existing link
  const { data: existingLink } = await supabase
    .from('redmine_issue_links')
    .select('*')
    .eq('integration_id', integration.id)
    .eq('redmine_issue_id', issue.id)
    .single();

  // Map tracker to Axionn entity type
  const trackerName = issue.tracker?.name || 'Task';
  const entityType = integration.tracker_mappings?.[trackerName] || 'task';

  // Map status
  const statusName = issue.status?.name || 'New';
  const axionnStatus = integration.status_mappings?.[statusName] || mapDefaultStatus(statusName);

  // Map priority
  const priorityName = issue.priority?.name || 'Normal';
  const axionnPriority = integration.priority_mappings?.[priorityName] || priorityName;

  // Find or create Axionn entity
  let axionnEntityId = existingLink?.axionn_entity_id;

  if (!axionnEntityId) {
    // Try to find by external ID or create new
    const { data: existingEntity } = await supabase
      .from(entityType === 'user_story' ? 'user_stories' : 'impediments')
      .select('id')
      .eq('organization_id', integration.organization_id)
      .eq('external_id', `redmine-${issue.id}`)
      .single();

    if (existingEntity) {
      axionnEntityId = existingEntity.id;
    }
  }

  if (axionnEntityId) {
    // Update existing
    const updateData = buildUpdateData(issue, axionnStatus, axionnPriority, integration);
    await updateAxionnEntity(supabase, entityType, axionnEntityId, updateData, correlationId);
    return { action: 'updated' };
  } else if (integration.sync_direction !== 'axionn_to_redmine') {
    // Create new
    const createData = buildCreateData(issue, entityType, integration);
    const newEntity = await createAxionnEntity(supabase, entityType, createData, correlationId);
    if (newEntity) {
      axionnEntityId = newEntity.id;
      await createLink(supabase, integration, issue, entityType, axionnEntityId, 'redmine_to_axionn', correlationId);
      return { action: 'created' };
    }
  }

  return { action: 'skipped' };
}

function mapDefaultStatus(redmineStatus: string): string {
  const statusMap: Record<string, string> = {
    'New': 'todo',
    'In Progress': 'in_progress',
    'Resolved': 'done',
    'Closed': 'done',
    'Rejected': 'cancelled',
    'Feedback': 'in_review',
  };
  return statusMap[redmineStatus] || 'todo';
}

function buildUpdateData(issue: RedmineIssue, status: string, priority: string, integration: any): any {
  return {
    title: issue.subject,
    description: issue.description || '',
    status: status,
    priority: priority,
    updated_at: new Date(issue.updated_on).toISOString(),
    external_updated_at: new Date(issue.updated_on).toISOString(),
  };
}

function buildCreateData(issue: RedmineIssue, entityType: string, integration: any): any {
  const baseData = {
    organization_id: integration.organization_id,
    project_id: integration.project_mappings?.find((m: any) => m.redmine_project_id === issue.project.id)?.axionn_project_id,
    external_id: `redmine-${issue.id}`,
    title: issue.subject,
    description: issue.description || '',
    status: mapDefaultStatus(issue.status?.name || 'New'),
    priority: issue.priority?.name || 'Normal',
    created_at: new Date(issue.created_on).toISOString(),
    updated_at: new Date(issue.updated_on).toISOString(),
    metadata_json: {
      redmine_issue_id: issue.id,
      redmine_project_id: issue.project.id,
      redmine_tracker: issue.tracker?.name,
      redmine_author_id: issue.author?.id,
      redmine_assignee_id: issue.assigned_to?.id,
      custom_fields: issue.custom_fields,
    },
  };

  if (entityType === 'user_story') {
    return {
      ...baseData,
      code: `RM-${issue.id}`,
      story_points: issue.estimated_hours || null,
    };
  } else {
    return {
      ...baseData,
      severity: mapPriorityToSeverity(issue.priority?.name),
      type: 'bug',
    };
  }
}

function mapPriorityToSeverity(priority: string): string {
  const map: Record<string, string> = {
    'Immediate': 'critical',
    'Urgent': 'high',
    'High': 'high',
    'Normal': 'medium',
    'Low': 'low',
  };
  return map[priority] || 'medium';
}

async function updateAxionnEntity(supabase: any, entityType: string, entityId: string, data: any, correlationId: string): Promise<void> {
  const table = entityType === 'user_story' ? 'user_stories' : 'impediments';
  await supabase.from(table).update(data).eq('id', entityId);
}

async function createAxionnEntity(supabase: any, entityType: string, data: any, correlationId: string): Promise<any> {
  const table = entityType === 'user_story' ? 'user_stories' : 'impediments';
  const { data: entity, error } = await supabase.from(table).insert(data).select().single();
  if (error) throw error;
  return entity;
}

async function createLink(
  supabase: any,
  integration: any,
  issue: RedmineIssue,
  entityType: string,
  entityId: string,
  direction: string,
  correlationId: string
): Promise<void> {
  await supabase.from('redmine_issue_links').insert({
    integration_id: integration.id,
    organization_id: integration.organization_id,
    redmine_issue_id: issue.id,
    redmine_project_id: issue.project.id,
    redmine_tracker_id: issue.tracker?.id,
    redmine_status_id: issue.status?.id,
    redmine_priority_id: issue.priority?.id,
    axionn_entity_type: entityType,
    axionn_entity_id: entityId,
    sync_direction: direction,
    last_synced_at: new Date().toISOString(),
    last_redmine_updated_on: new Date(issue.updated_on).toISOString(),
    sync_status: 'synced',
  });
}

async function bulkSyncIssues(supabase: any, integration: any, correlationId: string): Promise<any> {
  // This would be called by a scheduled job
  // Fetch issues from Redmine API and process
  let processed = 0, created = 0, updated = 0, skipped = 0, failed = 0;

  try {
    // Build Redmine API query
    const baseUrl = integration.base_url.replace(/\/$/, '');
    const apiKey = integration.api_key_encrypted; // Would need decryption
    const projectIds = integration.sync_filter_json?.project_ids || [];

    for (const projectId of projectIds) {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const url = `${baseUrl}/issues.json?project_id=${projectId}&limit=${limit}&offset=${offset}&sort=updated_on:desc`;
        const response = await fetch(url, {
          headers: { 'X-Redmine-API-Key': apiKey, 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error(`Redmine API error: ${response.status}`);

        const data = await response.json();
        const issues = data.issues || [];

        for (const issue of issues) {
          try {
            const result = await processIssue(supabase, integration, issue, correlationId);
            processed++;
            if (result.action === 'created') created++;
            else if (result.action === 'updated') updated++;
            else skipped++;
          } catch (e) {
            failed++;
            console.error(`Failed to process issue ${issue.id}:`, e);
          }
        }

        hasMore = issues.length === limit;
        offset += limit;

        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
    }
  } catch (error) {
    console.error('Bulk sync error:', error);
    failed++;
  }

  return { processed, created, updated, skipped, failed };
}