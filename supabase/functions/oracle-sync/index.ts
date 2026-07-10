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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { job_id, trigger_type = 'manual' } = body;

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
      throw new Error('Job not found');
    }

    const integration = job.oracle_integrations;
    const organizationId = integration.organization_id;

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

    // Log completion
    await supabase.rpc('log_oracle_sync_event', {
      p_job_id: job_id,
      p_integration_id: integration.id,
      p_organization_id: organizationId,
      p_trigger_type: trigger_type,
      p_status: result.failed > 0 ? 'partial' : 'completed',
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
        last_run_status: result.failed > 0 ? 'partial' : 'success',
        last_run_rows: result.loaded,
        last_run_duration_ms: totalDuration,
        last_run_error: result.failed > 0 ? `Failed rows: ${result.failed}` : null,
        incremental_watermark: result.newWatermark,
      })
      .eq('id', job_id);

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;

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
          p_trigger_type: 'manual',
          p_status: 'failed',
          p_error_details: { error: error.message },
          p_correlation_id: correlationId,
        });
      }
    }

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

  // In a real implementation, this would use Oracle's native driver (oracledb)
  // For this example, we'll simulate with a placeholder
  // Real implementation would:
  // 1. Connect to Oracle using oracledb or node-oracledb
  // 2. Execute query with bind parameters
  // 3. Stream results in batches
  // 4. Transform and load to PostgreSQL/Supabase

  // Simulated extraction
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
  };
}

async function simulateOracleExtract(query: string, params: any, batchSize: number): Promise<any[]> {
  // Placeholder - in reality would connect to Oracle
  // This simulates returning some rows
  console.log('[Oracle Sync] Would execute:', query, params);
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