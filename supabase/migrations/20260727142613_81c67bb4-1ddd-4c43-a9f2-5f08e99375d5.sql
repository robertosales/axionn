UPDATE public.okr_recalculation_queue
SET status = 'cancelled',
    cancelled_at = now(),
    processed_at = COALESCE(processed_at, now()),
    last_error = 'OKR_QUEUE_LEGACY_JOB_WITHOUT_V2_BINDING'
WHERE status = 'pending'
  AND (organization_id IS NULL OR key_result_id IS NULL OR metric_binding_id IS NULL);