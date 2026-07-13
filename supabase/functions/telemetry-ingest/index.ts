import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id, x-root-correlation-id, x-parent-correlation-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TelemetryEvent {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  project_id?: string;
  source?: 'web' | 'teams' | 'copilot' | 'api' | 'mobile' | 'cli';
  metadata_json?: Record<string, unknown>;
  session_id?: string;
}

interface IntegrationEvent {
  integration_type: string;
  external_system: string;
  event_type: string;
  status: 'success' | 'error' | 'partial' | 'timeout' | 'retry' | 'dead_letter';
  correlation_id?: string;
  metadata_json?: Record<string, unknown>;
  duration_ms?: number;
  error_code?: string;
  error_message?: string;
  retry_count?: number;
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

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const rootCorrelationId = req.headers.get('x-root-correlation-id') || correlationId;
  const parentCorrelationId = req.headers.get('x-parent-correlation-id');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let organizationId: string | null = null;

    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!authError && user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        organizationId = profile?.organization_id || null;
      }
    }

    const body = await req.json();
    const { events, type } = body;

    if (!events || !Array.isArray(events)) {
      return new Response(JSON.stringify({ error: 'Invalid payload: events array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    if (type === 'user_usage') {
      for (const event of events as TelemetryEvent[]) {
        const { data, error } = await supabase.rpc('log_user_usage_event', {
          p_tenant_id: organizationId,
          p_project_id: event.project_id,
          p_user_id: userId,
          p_event_type: event.event_type,
          p_entity_type: event.entity_type,
          p_entity_id: event.entity_id,
          p_source: event.source || 'web',
          p_metadata_json: event.metadata_json || {},
          p_session_id: event.session_id,
          p_correlation_id: correlationId,
        });

        results.push({ event_type: event.event_type, success: !error, error: error?.message, event_id: data });
      }
    } else if (type === 'integration_usage') {
      for (const event of events as IntegrationEvent[]) {
        const { data, error } = await supabase.rpc('log_integration_usage_event', {
          p_tenant_id: organizationId,
          p_integration_type: event.integration_type,
          p_external_system: event.external_system,
          p_event_type: event.event_type,
          p_status: event.status,
          p_correlation_id: event.correlation_id || correlationId,
          p_metadata_json: event.metadata_json || {},
          p_duration_ms: event.duration_ms,
          p_error_code: event.error_code,
          p_error_message: event.error_message,
          p_retry_count: event.retry_count || 0,
        });

        results.push({ event_type: event.event_type, success: !error, error: error?.message, event_id: data });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type. Must be "user_usage" or "integration_usage"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      correlation_id: correlationId,
      root_correlation_id: rootCorrelationId,
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Telemetry Ingest] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});