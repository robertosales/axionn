-- Manual OKR recalculation must claim only the job authorized by the caller.
create or replace function public.claim_okr_recalculation_job_v2(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
) returns setof public.okr_recalculation_queue
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'OKR_V2_QUEUE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_job_id is null or nullif(trim(p_worker_id), '') is null then
    raise exception 'OKR_V2_JOB_AND_WORKER_REQUIRED' using errcode = '22023';
  end if;

  return query
  update public.okr_recalculation_queue queue
     set status = 'processing',
         attempts = queue.attempts + 1,
         worker_id = trim(p_worker_id),
         locked_at = clock_timestamp(),
         lease_expires_at = clock_timestamp()
           + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))),
         last_error = null
   where queue.id = p_job_id
     and (
       (queue.status in ('pending', 'retry') and queue.available_at <= clock_timestamp())
       or (queue.status = 'processing' and queue.lease_expires_at <= clock_timestamp())
     )
  returning queue.*;
end;
$$;

revoke all on function public.claim_okr_recalculation_job_v2(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_okr_recalculation_job_v2(uuid, text, integer)
  to service_role;

