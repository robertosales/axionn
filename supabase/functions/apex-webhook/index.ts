import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readTextBody } from '../_shared/request-body.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-apex-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ApexWebhookPayload {
  event_type: string;
  application_id: number;
  page_id?: number;
  session_id: string;
  user: string;
  request_data: any;
  timestamp: string;
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

    // Verify webhook signature
    const signature = req.headers.get('x-apex-signature');
    const rawBody = await readTextBody(req, 1_000_000);

    // Find integration by webhook URL or application ID
    const payload: ApexWebhookPayload = JSON.parse(rawBody);
    if (!Number.isSafeInteger(payload.application_id) || payload.application_id <= 0
      || typeof payload.event_type !== 'string' || payload.event_type.length > 64
      || typeof payload.session_id !== 'string' || payload.session_id.length > 256
      || typeof payload.user !== 'string' || payload.user.length > 256
      || !payload.request_data || typeof payload.request_data !== 'object' || Array.isArray(payload.request_data)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const appId = payload.application_id;

    const { data: integration, error: intError } = await supabase
      .from('apex_integrations')
      .select('*')
      .eq('config_json->>webhook_application_id', appId.toString())
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      console.warn('[APEX Webhook] Integration not found for app:', appId);
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
      integrationId: integration.id,
    };

    if (!integration.is_active) {
      await recordApexHealth(healthContext, {
        status: 'degraded',
        latencyMs: Date.now() - startTime,
        correlationId,
        errorCode: 'INTEGRATION_INACTIVE',
        errorMessage: 'Apex integration is inactive',
        details: { application_id: appId },
      });
      return new Response(JSON.stringify({ error: 'Integration is inactive' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    healthContext = {
      supabase,
      organizationId,
      projectId: integration.project_id ?? null,
      integrationId: integration.id,
    };

    // Webhooks fail closed: an integration without a configured secret is not
    // allowed to process privileged writes.
    if (!integration.webhook_secret_encrypted) {
      return new Response(JSON.stringify({ error: 'Webhook authentication is not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    {
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isValid = await verifyApexSignature(rawBody, signature, integration.webhook_secret_encrypted);
      if (!isValid) {
        console.warn('[APEX Webhook] Invalid signature');
        await recordApexHealth(healthContext, {
          status: 'unhealthy',
          latencyMs: Date.now() - startTime,
          correlationId,
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Webhook signature validation failed',
          details: { application_id: appId },
        });
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Log usage event
    await supabase.rpc('log_apex_usage_event', {
      p_integration_id: integration.id,
      p_application_id: null, // Would lookup from apex_applications
      p_organization_id: organizationId,
      p_apex_session_id: payload.session_id,
      p_apex_user: payload.user,
      p_apex_app_id: payload.application_id,
      p_apex_page_id: payload.page_id,
      p_request_type: mapEventType(payload.event_type),
      p_endpoint_path: `/apex/webhook/${appId}`,
      p_parameters: payload.request_data,
      p_response_status: 200,
      p_response_time_ms: Date.now() - startTime,
      p_rows_returned: payload.request_data?.rows_returned,
      p_correlation_id: correlationId,
    });

    // Process event based on type
    await processApexEvent(supabase, integration, payload, correlationId);

    await recordApexHealth(healthContext, {
      status: 'healthy',
      latencyMs: Date.now() - startTime,
      correlationId,
      details: {
        event_type: payload.event_type,
        application_id: payload.application_id,
        session_id: payload.session_id,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      correlation_id: correlationId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[APEX Webhook] Error:', error);
    if (healthContext) {
      await recordApexHealth(healthContext, {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        correlationId,
        errorCode: 'WEBHOOK_PROCESSING_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
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

async function recordApexHealth(
  context: {
    supabase: any;
    organizationId: string;
    projectId: string | null;
    integrationId: string;
  },
  event: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    latencyMs: number;
    correlationId: string;
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
      provider: 'apex',
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
    console.error('[APEX Webhook] Failed to record integration health:', error);
  }
}

async function verifyApexSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  // APEX typically uses HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const providedHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) return false;
  const provided = new Uint8Array(32);
  for (let index = 0; index < provided.length; index++) {
    provided[index] = Number.parseInt(providedHex.slice(index * 2, index * 2 + 2), 16);
  }
  return crypto.subtle.verify('HMAC', key, provided, encoder.encode(payload));
}

function mapEventType(apexEvent: string): string {
  const map: Record<string, string> = {
    'page_submit': 'page_submit',
    'process': 'process',
    'report_query': 'report_query',
    'ajax': 'ajax',
    'dialog': 'dialog',
    'page_load': 'page_load',
  };
  return map[apexEvent] || 'webhook';
}

async function processApexEvent(
  supabase: any,
  integration: any,
  payload: ApexWebhookPayload,
  correlationId: string
): Promise<void> {
  const eventType = payload.event_type;

  switch (eventType) {
    case 'page_submit':
      await handlePageSubmit(supabase, integration, payload);
      break;
    case 'report_query':
      await handleReportQuery(supabase, integration, payload);
      break;
    case 'process':
      await handleProcess(supabase, integration, payload);
      break;
    default:
      console.log('[APEX Webhook] Unhandled event type:', eventType);
  }
}

async function handlePageSubmit(
  supabase: any,
  integration: any,
  payload: ApexWebhookPayload
): Promise<void> {
  // Page submit could be creating/updating HU, impediment, etc.
  const requestData = payload.request_data;
  const action = requestData?.action; // 'create_hu', 'update_hu', 'create_impediment', etc.

  if (!action) return;

  switch (action) {
      case 'create_hu':
        await createHUFromApex(supabase, integration, requestData);
        break;
      case 'update_hu':
        await updateHUFromApex(supabase, integration, requestData);
        break;
      case 'create_impediment':
        await createImpedimentFromApex(supabase, integration, requestData);
        break;
      case 'update_impediment':
        await updateImpedimentFromApex(supabase, integration, requestData);
        break;
    default:
      throw new Error(`APEX_ACTION_NOT_SUPPORTED: ${String(action).slice(0, 64)}`);
  }
}

async function resolveApexScope(supabase: any, integration: any): Promise<{ projectId: string; teamId: string }> {
  if (!integration.project_id) throw new Error('APEX_INTEGRATION_PROJECT_REQUIRED');
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, org_id, team_id')
    .eq('id', integration.project_id)
    .eq('org_id', integration.organization_id)
    .single();
  if (error || !project?.team_id) throw new Error('APEX_PROJECT_SCOPE_INVALID');
  return { projectId: project.id, teamId: project.team_id };
}

async function assertSprintScope(supabase: any, sprintId: unknown, teamId: string): Promise<string | null> {
  if (!sprintId) return null;
  const { data, error } = await supabase.from('sprints').select('id').eq('id', sprintId).eq('team_id', teamId).single();
  if (error || !data) throw new Error('APEX_SPRINT_SCOPE_INVALID');
  return data.id;
}

async function createHUFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const scope = await resolveApexScope(supabase, integration);
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 500) {
    throw new Error('APEX_HU_TITLE_REQUIRED');
  }
  const huData = {
    team_id: scope.teamId,
    code: data.code || `APEX-${Date.now()}`,
    title: data.title,
    description: data.description,
    story_points: data.story_points,
    status: data.status || 'backlog',
    priority: data.priority || 'medium',
  };

  const { data: hu, error } = await supabase
    .from('user_stories')
    .insert(huData)
    .select()
    .single();

  if (error) throw error;

  // Log telemetry
  await supabase.rpc('log_user_usage_event', {
    p_tenant_id: integration.organization_id,
    p_project_id: scope.projectId,
    p_user_id: null,
    p_event_type: 'hu_created',
    p_entity_type: 'user_story',
    p_entity_id: hu.id,
    p_source: 'apex',
    p_metadata_json: { apex_application_id: integration.config_json?.apex_app_id },
    p_correlation_id: crypto.randomUUID(),
  });
}

async function updateHUFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const scope = await resolveApexScope(supabase, integration);
  const updates: any = {};

  if (data.title) updates.title = data.title;
  if (data.description) updates.description = data.description;
  if (data.story_points != null) updates.story_points = data.story_points;
  if (data.status) updates.status = data.status;
  if (data.priority) updates.priority = data.priority;

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('user_stories')
    .update(updates)
    .eq('id', data.hu_id)
    .eq('team_id', scope.teamId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error('APEX_HU_NOT_FOUND_IN_SCOPE');
}

async function createImpedimentFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const scope = await resolveApexScope(supabase, integration);
  const sprintId = await assertSprintScope(supabase, data.sprint_id, scope.teamId);
  const impedimentData = {
    team_id: scope.teamId,
    sprint_id: sprintId,
    reason: data.title || data.description,
    criticality: data.severity || 'medium',
    type: data.type || 'other',
  };
  if (!impedimentData.reason) throw new Error('APEX_IMPEDIMENT_REASON_REQUIRED');

  const { error } = await supabase
    .from('impediments')
    .insert(impedimentData);

  if (error) throw error;
}

async function updateImpedimentFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const scope = await resolveApexScope(supabase, integration);
  const updates: any = {};

  if (data.title || data.description) updates.reason = data.title || data.description;
  if (data.severity) updates.criticality = data.severity;
  if (data.type) updates.type = data.type;
  if (data.resolution) updates.resolution = data.resolution;
  if (data.status === 'resolved') updates.resolved_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) throw new Error('APEX_IMPEDIMENT_UPDATE_EMPTY');
  const { data: updated, error } = await supabase
    .from('impediments')
    .update(updates)
    .eq('id', data.impediment_id)
    .eq('team_id', scope.teamId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error('APEX_IMPEDIMENT_NOT_FOUND_IN_SCOPE');
}

async function handleReportQuery(
  supabase: any,
  integration: any,
  payload: ApexWebhookPayload
): Promise<void> {
  // APEX is querying a report - could log for analytics
  // Or inject additional data into response
  console.log('[APEX Webhook] Report query:', payload.request_data?.report_name);
}

async function handleProcess(
  supabase: any,
  integration: any,
  payload: ApexWebhookPayload
): Promise<void> {
  // APEX process execution - could trigger background jobs
  console.log('[APEX Webhook] Process:', payload.request_data?.process_name);
}
