import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-id, x-git-provider, x-gitlab-token, x-hub-signature-256, x-github-event, x-gitlab-event',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GitWebhookPayload {
  event_type: string;
  provider: 'gitlab' | 'github' | 'bitbucket';
  payload: Record<string, unknown>;
  project_id: string;
  integration_id: string;
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
  let healthContext: {
    supabase: any;
    organizationId: string;
    projectId: string | null;
    integrationId: string;
  } | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const provider = req.headers.get('x-git-provider') || 'gitlab';
    const eventType = normalizeEventType(req.headers.get('x-gitlab-event') || req.headers.get('x-github-event') || 'unknown');
    const signature = req.headers.get('x-gitlab-token') || req.headers.get('x-hub-signature-256');

    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const integrationId = req.headers.get('x-integration-id');
    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'Missing x-integration-id header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: integration, error: integrationError } = await supabase
      .from('git_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      console.error('[Git Webhook] Integration not found:', integrationId);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = integration.organization_id;
    healthContext = {
      supabase,
      organizationId,
      projectId: integration.project_id ?? null,
      integrationId,
    };

    if (!integration.is_active) {
      await recordIntegrationHealth(healthContext, {
        status: 'degraded',
        errorCode: 'INTEGRATION_INACTIVE',
        errorMessage: 'Git integration is inactive',
        correlationId,
        latencyMs: Date.now() - startTime,
      });
      return new Response(JSON.stringify({ error: 'Integration is inactive' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature if configured
    if (integration.webhook_secret_encrypted) {
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing webhook signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isValid = await verifyWebhookSignature(provider, rawBody, signature, integration.webhook_secret_encrypted);
      if (!isValid) {
        console.warn('[Git Webhook] Invalid signature for integration:', integrationId);
        await logIntegrationEvent(supabase, organizationId, integrationId, 'webhook_received', 'error', {
          error_code: 'INVALID_SIGNATURE',
          event_type: eventType,
        }, correlationId);
        await recordIntegrationHealth(healthContext, {
          status: 'unhealthy',
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Webhook signature validation failed',
          correlationId,
          latencyMs: Date.now() - startTime,
        });
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Capturar headers relevantes para auditoria
    const relevantHeaders: Record<string, string> = {};
    [
      'x-integration-id', 'x-git-provider', 'x-gitlab-event', 'x-github-event',
      'x-gitlab-token', 'x-hub-signature-256', 'content-type', 'user-agent',
      'x-forwarded-for', 'x-real-ip',
    ].forEach(k => {
      const v = req.headers.get(k);
      if (v) relevantHeaders[k] = v;
    });

    // Gerar provider_event_id determinístico para garantia de idempotência.
    const providerEventId =
      extractProviderEventId(provider, eventType, payload) ??
      `${integrationId}-${eventType}-${correlationId}`;

    // Store raw event for audit and async processing
    const { data: gitEvent, error: eventError } = await supabase
      .from('git_events')
      .insert({
        integration_id: integrationId,
        organization_id: organizationId,
        event_type: eventType,
        event_action: extractEventAction(eventType, payload),
        provider_event_id: providerEventId,
        payload: payload,
        headers: relevantHeaders,
        correlation_id: correlationId,
        processed: false,
      })
      .select()
      .single();

    if (eventError) {
      // 23505 = unique violation → evento duplicado, retornar 200 idempotente
      if (eventError.code === '23505') {
        console.log('[Git Webhook] Duplicate event (idempotent), skipping:', providerEventId);
        await recordIntegrationHealth(healthContext, {
          status: 'healthy',
          correlationId,
          latencyMs: Date.now() - startTime,
          details: { event_type: eventType, provider, duplicate: true },
        });
        return new Response(
          JSON.stringify({
            success: true,
            duplicate: true,
            provider_event_id: providerEventId,
            correlation_id: correlationId,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.error('[Git Webhook] Failed to store event:', {
        code: eventError.code,
        message: eventError.message,
        details: eventError.details,
        hint: eventError.hint,
        correlation_id: correlationId,
      });
      await recordIntegrationHealth(healthContext, {
        status: 'unhealthy',
        errorCode: 'EVENT_PERSISTENCE_FAILED',
        errorMessage: `${eventError.code}: ${eventError.message}`,
        correlationId,
        latencyMs: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to store event',
          code: eventError.code,
          correlation_id: correlationId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Process event asynchronously based on type
    await processGitEvent(supabase, integration, gitEvent, payload, eventType, correlationId);

    // Log integration usage
    await logIntegrationEvent(supabase, organizationId, integrationId, 'webhook_received', 'success', {
      event_type: eventType,
      provider,
      processing_time_ms: Date.now() - startTime,
    }, correlationId);

    await recordIntegrationHealth(healthContext, {
      status: 'healthy',
      correlationId,
      latencyMs: Date.now() - startTime,
      details: { event_type: eventType, provider },
    });

    return new Response(JSON.stringify({
      success: true,
      event_id: gitEvent.id,
      correlation_id: correlationId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Git Webhook] Unexpected error:', error);
    if (healthContext) {
      await recordIntegrationHealth(healthContext, {
        status: 'unhealthy',
        errorCode: 'UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
        correlationId,
        latencyMs: Date.now() - startTime,
      });
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

async function recordIntegrationHealth(
  context: {
    supabase: any;
    organizationId: string;
    projectId: string | null;
    integrationId: string;
  },
  event: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    correlationId: string;
    latencyMs: number;
    errorCode?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await context.supabase
    .from('integration_health_events')
    .insert({
      organization_id: context.organizationId,
      project_id: context.projectId,
      provider: 'git',
      integration_id: context.integrationId,
      check_type: 'webhook',
      status: event.status,
      latency_ms: event.latencyMs,
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage ?? null,
      details: event.details ?? {},
      correlation_id: event.correlationId,
    });

  if (error) {
    // Health telemetry must never interrupt webhook processing.
    console.error('[Git Webhook] Failed to record integration health:', error);
  }
}

async function verifyWebhookSignature(
  provider: string,
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  if (provider === 'gitlab') {
    // GitLab uses X-Gitlab-Token header with the secret token
    return signature === secret;
  } else if (provider === 'github') {
    // GitHub uses X-Hub-Signature-256: sha256=...
    const expectedSignature = signature.replace('sha256=', '');
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const actualSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return actualSignature === expectedSignature;
  }
  return false;
}

async function processGitEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  eventType: string,
  correlationId: string
): Promise<void> {
  try {
    switch (eventType) {
      case 'push':
      case 'push_events':
        await processPushEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'merge_request':
      case 'pull_request':
        await processMergeRequestEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'pipeline':
      case 'pipeline_events':
        await processPipelineEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'job':
      case 'job_events':
        await processJobEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'deployment':
      case 'deployment_events':
        await processDeploymentEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'note':
      case 'note_events':
        await processNoteEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      case 'issue':
      case 'work_item':
        await processIssueEvent(supabase, integration, gitEvent, payload, correlationId);
        break;
      default:
        console.log('[Git Webhook] Unhandled event type:', eventType);
    }

    // Mark as processed
    await supabase
      .from('git_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', gitEvent.id);
  } catch (error) {
    console.error('[Git Webhook] Error processing event:', error);
    await supabase
      .from('git_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: error instanceof Error ? error.message : String(error),
      })
      .eq('id', gitEvent.id);
  }
}

async function processPushEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const commits = (payload.commits as unknown[]) || [];
  const ref = payload.ref as string; // e.g., "refs/heads/feature/AXIONN-123"
  const branchName = ref?.replace('refs/heads/', '');
  const projectId = payload.project?.id || payload.repository?.id;

  for (const commit of commits) {
    const commitData = commit as Record<string, unknown>;
    const message = commitData.message as string;
    const huIds = extractHUIds(message);

    if (huIds.length > 0) {
      for (const huId of huIds) {
        await linkHUToCommit(supabase, integration.organization_id, huId, {
          commit_sha: commitData.id as string,
          commit_message: message,
          branch_name: branchName,
          author_email: (commitData.author?.email as string) || (commitData.author?.username as string),
          author_name: (commitData.author?.name as string) || (commitData.author?.username as string),
          committed_at: new Date(commitData.timestamp as string).toISOString(),
          repository_url: payload.repository?.url || payload.project?.web_url,
        }, correlationId);
      }
    }

    // Store commit event
    await supabase.from('git_commits').insert({
      git_event_id: gitEvent.id,
      integration_id: integration.id,
      organization_id: integration.organization_id,
      commit_sha: commitData.id as string,
      commit_message: message,
      branch_name: branchName,
      author_email: (commitData.author?.email as string) || (commitData.author?.username as string),
      author_name: (commitData.author?.name as string) || (commitData.author?.username as string),
      committed_at: new Date(commitData.timestamp as string).toISOString(),
      repository_url: payload.repository?.url || payload.project?.web_url,
      hu_ids: huIds,
    });
  }
}

async function processMergeRequestEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const mr = payload.object_attributes || payload.merge_request || payload;
  const action = mr.action || mr.state; // opened, updated, merged, closed
  const mrId = mr.iid || mr.number;
  const title = mr.title as string;
  const description = mr.description as string;
  const sourceBranch = mr.source_branch as string;
  const targetBranch = mr.target_branch as string;
  const authorEmail = mr.author?.email || mr.user?.email;
  const authorUsername = mr.author?.username || mr.user?.login;
  const huIds = extractHUIds(`${title} ${description}`);

  // Store MR event
  const { data: mrRecord } = await supabase.from('git_merge_requests').upsert({
    integration_id: integration.id,
    organization_id: integration.organization_id,
    mr_iid: mrId,
    mr_id: mr.id,
    title,
    description,
    state: mr.state,
    action,
    source_branch: sourceBranch,
    target_branch: targetBranch,
    author_email: authorEmail,
    author_username: authorUsername,
    author_id: mr.author?.id || mr.user?.id,
    web_url: mr.web_url,
    created_at: new Date(mr.created_at).toISOString(),
    updated_at: new Date(mr.updated_at).toISOString(),
    merged_at: mr.merged_at ? new Date(mr.merged_at).toISOString() : null,
    closed_at: mr.closed_at ? new Date(mr.closed_at).toISOString() : null,
    hu_ids: huIds,
    payload: payload,
  }, { onConflict: 'integration_id,mr_iid' }).select().single();

  // Link HUs to MR
  for (const huId of huIds) {
    await linkHUToMR(supabase, integration.organization_id, huId, mrRecord.id, correlationId);
  }

  // Auto-update HU status based on MR action
  if (['merged', 'closed'].includes(action) && huIds.length > 0) {
    for (const huId of huIds) {
      await updateHUStatusFromMR(supabase, integration.organization_id, huId, action, correlationId);
    }
  }
}

async function processPipelineEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const pipeline = payload.object_attributes || payload.pipeline || payload;
  const status = pipeline.status;
  const ref = pipeline.ref;
  const sha = pipeline.sha;
  const duration = pipeline.duration;
  const webUrl = pipeline.web_url;

  await supabase.from('gitlab_pipeline_events').insert({
    git_event_id: gitEvent.id,
    integration_id: integration.id,
    organization_id: integration.organization_id,
    pipeline_id: pipeline.id,
    pipeline_iid: pipeline.iid,
    status,
    ref,
    sha,
    duration_seconds: duration,
    web_url: webUrl,
    created_at: new Date(pipeline.created_at).toISOString(),
    updated_at: new Date(pipeline.updated_at).toISOString(),
    finished_at: pipeline.finished_at ? new Date(pipeline.finished_at).toISOString() : null,
    payload: payload,
  });

  // If pipeline succeeded and is on main/production branch, create deployment event
  if (status === 'success' && (ref === 'main' || ref === 'master' || ref === 'production')) {
    await supabase.from('gitlab_deployment_events').insert({
      integration_id: integration.id,
      organization_id: integration.organization_id,
      pipeline_id: pipeline.id,
      commit_sha: sha,
      environment: ref === 'production' ? 'production' : 'staging',
      status: 'success',
      deployed_at: new Date().toISOString(),
      correlation_id: correlationId,
    });
  }
}

async function processJobEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const job = payload.object_attributes || payload.job || payload;
  // Store job details for DORA metrics (duration, status, etc.)
  await supabase.from('gitlab_job_events').insert({
    git_event_id: gitEvent.id,
    integration_id: integration.id,
    organization_id: integration.organization_id,
    job_id: job.id,
    job_name: job.name,
    stage: job.stage,
    status: job.status,
    duration_seconds: job.duration,
    started_at: job.started_at ? new Date(job.started_at).toISOString() : null,
    finished_at: job.finished_at ? new Date(job.finished_at).toISOString() : null,
    pipeline_id: job.pipeline_id,
    correlation_id: correlationId,
  });
}

async function processDeploymentEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const deployment = payload.object_attributes || payload.deployment || payload;
  await supabase.from('gitlab_deployment_events').insert({
    git_event_id: gitEvent.id,
    integration_id: integration.id,
    organization_id: integration.organization_id,
    deployment_id: deployment.id,
    environment: deployment.environment,
    status: deployment.status,
    commit_sha: deployment.sha,
    deployable_type: deployment.deployable_type,
    deployable_id: deployment.deployable_id,
    deployable_url: deployment.deployable_url,
    created_at: new Date(deployment.created_at).toISOString(),
    updated_at: new Date(deployment.updated_at).toISOString(),
    finished_at: deployment.finished_at ? new Date(deployment.finished_at).toISOString() : null,
    correlation_id: correlationId,
  });
}

async function processNoteEvent(
  supabase: any,
  integration: any,
  gitEvent: any,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  const note = payload.object_attributes || payload.note || payload;
  const noteableType = note.noteable_type; // MergeRequest, Commit, Issue, etc.
  const noteableId = note.noteable_id;

  if (noteableType === 'MergeRequest') {
    // Could trigger HU updates, notifications, etc.
    console.log('[Git Webhook] Note on MR:', noteableId);
  }
}

function extractHUIds(text: string): string[] {
  // Pattern: AXIONN-123, AXI-456, HU-789, #123, etc.
  const patterns = [
    /\b([A-Z]{2,10}-\d+)\b/g,      // AXIONN-123, PROJ-456
    /\b(HU-\d+)\b/gi,              // HU-123
    /#(\d+)\b/g,                   // #123
  ];

  const ids = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => ids.add(m.replace('#', '').toUpperCase()));
    }
  }
  return Array.from(ids);
}

async function linkHUToCommit(
  supabase: any,
  organizationId: string,
  huId: string,
  commitData: any,
  correlationId: string
): Promise<void> {
  // Find HU by external ID or code
  const { data: hu } = await supabase
    .from('user_stories')
    .select('id, project_id')
    .eq('organization_id', organizationId)
    .or(`code.eq.${huId},external_id.eq.${huId}`)
    .single();

  if (hu) {
    await supabase.from('hu_git_links').upsert({
      organization_id: organizationId,
      hu_id: hu.id,
      project_id: hu.project_id,
      git_entity_type: 'commit',
      git_entity_id: commitData.commit_sha,
      git_entity_data: commitData,
      linked_at: new Date().toISOString(),
      correlation_id: correlationId,
    }, { onConflict: 'organization_id,hu_id,git_entity_type,git_entity_id' });
  }
}

async function linkHUToMR(
  supabase: any,
  organizationId: string,
  huId: string,
  mrId: string,
  correlationId: string
): Promise<void> {
  const { data: hu } = await supabase
    .from('user_stories')
    .select('id, project_id')
    .eq('organization_id', organizationId)
    .or(`code.eq.${huId},external_id.eq.${huId}`)
    .single();

  if (hu) {
    await supabase.from('hu_git_links').upsert({
      organization_id: organizationId,
      hu_id: hu.id,
      project_id: hu.project_id,
      git_entity_type: 'merge_request',
      git_entity_id: mrId,
      git_entity_data: { mr_id: mrId },
      linked_at: new Date().toISOString(),
      correlation_id: correlationId,
    }, { onConflict: 'organization_id,hu_id,git_entity_type,git_entity_id' });
  }
}

async function updateHUStatusFromMR(
  supabase: any,
  organizationId: string,
  huId: string,
  action: string,
  correlationId: string
): Promise<void> {
  const { data: hu } = await supabase
    .from('user_stories')
    .select('id, status')
    .eq('organization_id', organizationId)
    .or(`code.eq.${huId},external_id.eq.${huId}`)
    .single();

  if (!hu) return;

  let newStatus: string | null = null;
  if (action === 'merged') {
    newStatus = 'done'; // or 'in_review' / 'in_homologation' based on config
  } else if (action === 'closed') {
    newStatus = 'cancelled';
  }

  if (newStatus && hu.status !== newStatus) {
    await supabase
      .from('user_stories')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', hu.id);

    await logIntegrationEvent(supabase, organizationId, null, 'hu_auto_updated', 'success', {
      hu_id: hu.id,
      hu_code: huId,
      previous_status: hu.status,
      new_status: newStatus,
      trigger: 'merge_request',
      action,
    }, correlationId);
  }
}

async function logIntegrationEvent(
  supabase: any,
  tenantId: string,
  integrationId: string | null,
  eventType: string,
  status: 'success' | 'error' | 'partial',
  metadata: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  await supabase.rpc('log_integration_usage_event', {
    p_tenant_id: tenantId,
    p_integration_type: 'gitlab',
    p_external_system: 'gitlab',
    p_event_type: eventType,
    p_status: status,
    p_correlation_id: correlationId,
    p_metadata_json: metadata,
  });
}

/**
 * Extrai um ID único do evento no provedor para idempotência.
 */
function extractProviderEventId(
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
): string | null {
  try {
    if (provider === 'gitlab') {
      const project = payload.project as Record<string, unknown> | undefined;
      const projectId = (project?.id as number | string | undefined) ?? payload.project_id;
      const attrs = payload.object_attributes as Record<string, unknown> | undefined;
      const key = eventType.toLowerCase().replace(' hook', '').replace(' events', '').trim();
      switch (key) {
        case 'push':
        case 'tag_push': {
          const commits = (payload.commits as unknown[]) ?? [];
          const first = commits[0] as Record<string, unknown> | undefined;
          const sha = (first?.id as string | undefined) ?? (payload.checkout_sha as string | undefined) ?? (payload.after as string | undefined);
          return projectId && sha ? `gitlab-push-${projectId}-${sha}` : null;
        }
        case 'merge_request':
          return attrs?.id ? `gitlab-mr-${attrs.id}` : null;
        case 'pipeline':
          return attrs?.id ? `gitlab-pipeline-${attrs.id}` : null;
        case 'job':
          return payload.build_id ? `gitlab-job-${payload.build_id}` : null;
        case 'deployment':
          return payload.deployment_id ? `gitlab-deploy-${payload.deployment_id}` : null;
        case 'note':
          return attrs?.id ? `gitlab-note-${attrs.id}` : null;
        default:
          return null;
      }
    }
    if (provider === 'github') {
      const delivery = payload['x-github-delivery'] as string | undefined;
      return delivery ? `github-${eventType}-${delivery}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extrai ação específica de um evento (opened, merged, success, etc.).
 */
function extractEventAction(
  _eventType: string,
  payload: Record<string, unknown>,
): string | null {
  try {
    const attrs = payload.object_attributes as Record<string, unknown> | undefined;
    return (
      (attrs?.action as string | undefined) ??
      (attrs?.state as string | undefined) ??
      (attrs?.status as string | undefined) ??
      (payload.action as string | undefined) ??
      null
    );
  } catch {
    return null;
  }
}
