-- Compatibility preflight for Phase 6 corporate integrations.
-- Runs before 20260709090000_phase6_corporate_integrations.sql.
-- Pre-creates the 18-parameter oracle sync RPC so older Phase 6 SQL variants
-- that grant this exact signature do not fail with ERROR 42883.

CREATE OR REPLACE FUNCTION public.log_oracle_sync_event(
    p_job_id UUID,
    p_integration_id UUID,
    p_organization_id UUID,
    p_status TEXT,
    p_trigger_type TEXT DEFAULT NULL,
    p_rows_extracted INTEGER DEFAULT 0,
    p_rows_transformed INTEGER DEFAULT 0,
    p_rows_loaded INTEGER DEFAULT 0,
    p_rows_failed INTEGER DEFAULT 0,
    p_bytes_processed BIGINT DEFAULT 0,
    p_extract_duration_ms INTEGER DEFAULT NULL,
    p_transform_duration_ms INTEGER DEFAULT NULL,
    p_load_duration_ms INTEGER DEFAULT NULL,
    p_total_duration_ms INTEGER DEFAULT NULL,
    p_extract_checkpoint JSONB DEFAULT NULL,
    p_transform_checkpoint JSONB DEFAULT NULL,
    p_error_details JSONB DEFAULT '{}'::jsonb,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_run_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.oracle_sync_events (
        job_id, integration_id, organization_id, run_id,
        trigger_type, status,
        rows_extracted, rows_transformed, rows_loaded, rows_failed, bytes_processed,
        extract_duration_ms, transform_duration_ms, load_duration_ms, total_duration_ms,
        extract_checkpoint, transform_checkpoint,
        error_details, error_sample, correlation_id
    ) VALUES (
        p_job_id, p_integration_id, p_organization_id, v_run_id,
        p_trigger_type, p_status,
        p_rows_extracted, p_rows_transformed, p_rows_loaded, p_rows_failed, p_bytes_processed,
        p_extract_duration_ms, p_transform_duration_ms, p_load_duration_ms, p_total_duration_ms,
        p_extract_checkpoint, p_transform_checkpoint,
        p_error_details, NULL, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_oracle_sync_event(
    UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT,
    INTEGER, INTEGER, INTEGER, INTEGER, JSONB, JSONB, JSONB, UUID
) TO authenticated;
