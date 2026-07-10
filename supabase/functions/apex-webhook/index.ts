import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature
    const signature = req.headers.get('x-apex-signature');
    const rawBody = await req.text();

    // Find integration by webhook URL or application ID
    const payload: ApexWebhookPayload = JSON.parse(rawBody);
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

    // Verify signature if configured
    if (integration.webhook_secret_encrypted && signature) {
      const isValid = await verifyApexSignature(rawBody, signature, integration.webhook_secret_encrypted);
      if (!isValid) {
        console.warn('[APEX Webhook] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const organizationId = integration.organization_id;

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

    return new Response(JSON.stringify({
      success: true,
      correlation_id: correlationId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[APEX Webhook] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      correlation_id: correlationId,
      message: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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

  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // APEX may send signature as hex or base64
  const providedHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return expectedHex === providedHex;
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

  try {
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
        console.log('[APEX Webhook] Unknown action:', action);
    }
  } catch (error) {
    console.error('[APEX Webhook] Page submit error:', error);
  }
}

async function createHUFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const huData = {
    organization_id: integration.organization_id,
    project_id: data.project_id,
    code: data.code || `APEX-${Date.now()}`,
    title: data.title,
    description: data.description,
    story_points: data.story_points,
    status: data.status || 'backlog',
    priority: data.priority || 'medium',
    assignee_id: data.assignee_id,
    created_by: data.apex_user_id,
    external_source: 'apex',
    external_id: data.apex_item_id,
    metadata: { apex_application_id: integration.config_json?.apex_app_id },
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
    p_project_id: data.project_id,
    p_user_id: data.apex_user_id,
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
  const updates: any = {};

  if (data.title) updates.title = data.title;
  if (data.description) updates.description = data.description;
  if (data.story_points) updates.story_points = data.story_points;
  if (data.status) updates.status = data.status;
  if (data.priority) updates.priority = data.priority;
  if (data.assignee_id) updates.assignee_id = data.assignee_id;

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('user_stories')
    .update(updates)
    .eq('id', data.hu_id)
    .eq('organization_id', integration.organization_id);

  if (error) throw error;
}

async function createImpedimentFromApex(
  supabase: any,
  integration: any,
  data: any
): Promise<void> {
  const impedimentData = {
    organization_id: integration.organization_id,
    project_id: data.project_id,
    sprint_id: data.sprint_id,
    title: data.title,
    description: data.description,
    severity: data.severity || 'medium',
    status: data.status || 'open',
    assignee_id: data.assignee_id,
    reported_by: data.apex_user_id,
    external_source: 'apex',
    external_id: data.apex_item_id,
    metadata: { apex_application_id: integration.config_json?.apex_app_id },
  };

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
  const updates: any = { updated_at: new Date().toISOString() };

  if (data.title) updates.title = data.title;
  if (data.description) updates.description = data.description;
  if (data.severity) updates.severity = data.severity;
  if (data.status) updates.status = data.status;
  if (data.assignee_id) updates.assignee_id = data.assignee_id;
  if (data.resolution) updates.resolution = data.resolution;
  if (data.status === 'resolved') updates.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from('impediments')
    .update(updates)
    .eq('id', data.impediment_id)
    .eq('organization_id', integration.organization_id);

  if (error) throw error;
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