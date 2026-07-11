import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  let jobId: string | null = null;
  let triggerType = 'manual';
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

    const body = await req.json();
    const { job_id, trigger_type = 'manual' } = body;
    jobId = job_id ?? null;
    triggerType = trigger_type;

    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get job config
    const { data: job, error: jobError } = await supabase
      .from('oracle_sync_jobs')
      .select('*, oracle_integrations(*)')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.warn('[Oracle Sync] Job not found:', job_id);
      return new Response(JSON.stringify({
        error: 'Job not found',
        error_code: 'JOB_NOT_FOUND',
        correlation_id: correlationId,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const integration = job.oracle_integrations;
    const organizationId = integration.organization_id;
    healthContext = {
      supabase,
      organizationId,
      projectId: integration.project_id ?? null,
      integrationId: integration.id,
    };

    if (!job.is_active || !integration.is_active) {
      await recordOracleHealth(healthContext, {
        status: 'degraded',
        latencyMs: Date.now() - startTime,
        correlationId,
        errorCode: 'INTEGRATION_OR_JOB_INACTIVE',
        errorMessage: 'Oracle integration or sync job is inactive',
        details: { job_id },
      });
      return new Response(JSON.stringify({ error: 'Integration or job is inactive' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log start
    await supabase.rpc('log_oracle_sync_event', {
      p_job_id: job_id,
      p_integration_id: integration.id,
      p_organization_id: organizationId,
      p_trigger_type: trigger_type,
      p_status: 'started',
      p_correlation_id: correlationId,
    });

    // Execute sync based on strategy
    let result;
    switch (job.extraction_strategy) {
      case 'incremental_timestamp':
        result = await syncIncrementalTimestamp(supabase, job, integration, correlationId);
        break;
      case 'incremental_id':
        result = await syncIncrementalId(supabase, job, integration, correlationId);
        break;
      case 'full':
        result = await syncFull(supabase, job, integration, correlationId);
        break;
      case 'cdc':
        result = await syncCDC(supabase, job, integration, correlationId);
        break;
      default:
        throw new Error(`Unsupported extraction strategy: ${job.extraction_strategy}`);
    }

    const totalDuration = Date.now() - startTime;
    const connectorUnavailable = result.simulated === true;
    const completedWithErrors = result.failed > 0 || connectorUnavailable;

    // Log completion
    await supabase.rpc('log_oracle_sync_event', {
      p_job_id: job_id,
      p_integration_id: integration.id,
      p_organization_id: organizationId,
      p_trigger_type: trigger_type,
      p_status: completedWithErrors ? 'partial' : 'completed',
      p_rows_extracted: result.extracted,
      p_rows_transformed: result.transformed,
      p_rows_loaded: result.loaded,
      p_rows_failed: result.failed,
      p_extract_duration_ms: result.extractDuration,
      p_transform_duration_ms: result.transformDuration,
      p_load_duration_ms: result.loadDuration,
      p_total_duration_ms: totalDuration,
      p_correlation_id: correlationId,
    });

    // Update job last run info
    await supabase
      .from('oracle_sync_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: completedWithErrors ? 'partial' : 'success',
        last_run_rows: result.loaded,
        last_run_duration_ms: totalDuration,
        last_run_error: connectorUnavailable
          ? 'Oracle connector is not configured in this runtime'
          : result.failed > 0
            ? `Failed rows: ${result.failed}`
            : null,
        incremental_watermark: result.newWatermark,
      })
      .eq('id', job_id);

    await recordOracleHealth(healthContext, {
      status: completedWithErrors ? 'degraded' : 'healthy',
      latencyMs: totalDuration,
      correlationId,
      errorCode: connectorUnavailable
        ? 'ORACLE_CONNECTOR_NOT_CONFIGURED'
        : result.failed > 0
          ? 'PARTIAL_SYNC'
          : undefined,
      errorMessage: connectorUnavailable
        ? 'Oracle connector is not configured in this runtime'
        : result.failed > 0
          ? `${result.failed} row(s) failed during synchronization`
          : undefined,
      details: {
        job_id,
        trigger_type,
        extracted: result.extracted,
        transformed: result.transformed,
        loaded: result.loaded,
        failed: result.failed,
        simulated: connectorUnavailable,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      correlation_id: correlationId,
      ...result,
      total_duration_ms: totalDuration,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Oracle Sync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (healthContext) {
      if (jobId) {
        await healthContext.supabase
          .from('oracle_sync_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: 'failed',
            last_run_duration_ms: Date.now() - startTime,
            last_run_error: errorMessage.slice(0, 500),
          })
          .eq('id', jobId);
      }

      await recordOracleHealth(healthContext, {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        correlationId,
        errorCode: 'SYNC_FAILED',
        errorMessage,
        details: { job_id: jobId },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (jobId) {
      const { data: job } = await supabase
        .from('oracle_sync_jobs')
        .select('organization_id, oracle_integrations!inner(id)')
        .eq('id', jobId)
        .single();

      if (job) {
        await supabase.rpc('log_oracle_sync_event', {
          p_job_id: jobId,
          p_integration_id: job.oracle_integrations.id,
          p_organization_id: job.organization_id,
          p_trigger_type: triggerType,
          p_status: 'failed',
          p_error_details: { error: errorMessage.slice(0, 500) },
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

async function recordOracleHealth(
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
      provider: 'oracle',
      integration_id: context.integrationId,
      check_type: 'sync',
      status: event.status,
      latency_ms: event.latencyMs,
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage?.slice(0, 500) ?? null,
      details: event.details ?? {},
      correlation_id: event.correlationId,
    });

  if (error) {
    // Health telemetry must not interrupt the synchronization workflow.
    console.error('[Oracle Sync] Failed to record integration health:', error);
  }
}

async function syncIncrementalTimestamp(
  supabase: any,
  job: any,
  integration: any,
  correlationId: string
): Promise<any> {
  const watermark = job.incremental_watermark || '1970-01-01T00:00:00Z';
  const column = job.incremental_column || 'updated_at';

  let query = job.source_query;
  if (!query) {
    const schema = job.source_schema || 'public';
    const table = job.source_table;
    query = `SELECT * FROM ${schema}.${table} WHERE ${column} > :watermark ORDER BY ${column} ASC`;
  }

  return executeSync(supabase, job, integration, query, { watermark }, correlationId);
}

async function syncIncrementalId(
  supabase: any,
  job: any,
  integration: any,
  correlationId: string
): Promise<any> {
  const watermark = job.incremental_watermark || '0';
  const column = job.incremental_column || 'id';

  let query = job.source_query;
  if (!query) {
    const schema = job.source_schema || 'public';
    const table = job.source_table;
    query = `SELECT * FROM ${schema}.${table} WHERE ${column} > :watermark ORDER BY ${column} ASC`;
  }

  return executeSync(supabase, job, integration, query, { watermark }, correlationId);
}

async function syncFull(
  supabase: any,
  job: any,
  integration: any,
  correlationId: string
): Promise<any> {
  let query = job.source_query;
  if (!query) {
    const schema = job.source_schema || 'public';
    const table = job.source_table;
    query = `SELECT * FROM ${schema}.${table}`;
  }

  return executeSync(supabase, job, integration, query, {}, correlationId);
}

async function syncCDC(
  supabase: any,
  job: any,
  integration: any,
  correlationId: string
): Promise<any> {
  // Change Data Capture - would require Oracle GoldenGate or similar
  // For now, fallback to incremental timestamp
  return syncIncrementalTimestamp(supabase, job, integration, correlationId);
}

async function executeSync(
  supabase: any,
  job: any,
  integration: any,
  query: string,
  params: Record<string, any>,
  correlationId: string
): Promise<any> {
  const extractStart = Date.now();
  const batchSize = job.batch_size || 10000;

  // In a real implementation, this would use Oracle's native driver (oracledb).
  // This runtime remains a placeholder and should not be treated as a successful
  // data extraction until a real Oracle connector is implemented and validated.
  // Real implementation would:
  // 1. Connect to Oracle using oracledb or node-oracledb
  // 2. Execute query with bind parameters
  // 3. Stream results in batches
  // 4. Transform and load to PostgreSQL/Supabase

  const extractedRows = await simulateOracleExtract(query, params, batchSize);
  const extractDuration = Date.now() - extractStart;

  // Transform
  const transformStart = Date.now();
  const transformedRows = await transformRows(extractedRows, job.column_mapping, job.transform_sql);
  const transformDuration = Date.now() - transformStart;

  // Load
  const loadStart = Date.now();
  const { loaded, failed, newWatermark } = await loadToAxionn(supabase, job, transformedRows, correlationId);
  const loadDuration = Date.now() - loadStart;

  return {
    extracted: extractedRows.length,
    transformed: transformedRows.length,
    loaded,
    failed,
    extractDuration,
    transformDuration,
    loadDuration,
    newWatermark,
    simulated: true,
  };
}

async function simulateOracleExtract(query: string, params: any, batchSize: number): Promise<any[]> {
  // Placeholder - this runtime does not yet connect to Oracle.
  // It intentionally returns zero rows so the job is marked as degraded and
  // the operational health remains truthful.
  console.log('[Oracle Sync] Placeholder execution; no Oracle connection established:', query, params, { batchSize });
  return [];
}

async function transformRows(rows: any[], columnMapping: any, transformSql: string): Promise<any[]> {
  if (!transformSql && Object.keys(columnMapping || {}).length === 0) {
    return rows;
  }

  // Apply column mapping
  const mapped = rows.map(row => {
    const newRow: any = {};
    for (const [sourceCol, targetCol] of Object.entries(columnMapping || {})) {
      newRow[targetCol] = row[sourceCol];
    }
    // Keep unmapped columns
    for (const [col, val] of Object.entries(row)) {
      if (!columnMapping || !columnMapping[col]) {
        newRow[col] = val;
      }
    }
    return newRow;
  });

  // If transform SQL provided, would execute it
  // For now, return mapped rows
  return mapped;
}

async function loadToAxionn(
  supabase: any,
  job: any,
  rows: any[],
  correlationId: string
): Promise<{ loaded: number; failed: number; newWatermark?: string }> {
  if (rows.length === 0) return { loaded: 0, failed: 0 };

  const targetTable = job.target_table;
  const targetSchema = job.target_schema || 'public';
  const fullTable = `${targetSchema}.${targetTable}`;

  let loaded = 0;
  let failed = 0;
  let lastWatermark: string | undefined;

  // Process in batches
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);

    try {
      // Upsert batch
      const { error } = await supabase
        .from(targetTable)
        .upsert(batch, { onConflict: 'id' }); // Assumes 'id' is primary key

      if (error) {
        console.error('Batch upsert error:', error);
        failed += batch.length;
      } else {
        loaded += batch.length;
        // Track watermark if incremental column exists
        if (job.incremental_column && batch.length > 0) {
          const lastRow = batch[batch.length - 1];
          lastWatermark = lastRow[job.incremental_column];
        }
      }
    } catch (e) {
      failed += batch.length;
      console.error('Batch load error:', e);
    }
  }

  return { loaded, failed, newWatermark: lastWatermark };
}
