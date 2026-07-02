create table if not exists public.ai_usage_rate_limits (
  company_id uuid primary key references public.companies(id) on delete cascade,
  per_user_per_minute integer not null default 10 check (per_user_per_minute > 0),
  per_company_per_minute integer not null default 60 check (per_company_per_minute > 0),
  max_concurrent integer not null default 5 check (max_concurrent > 0),
  reservation_ttl_minutes integer not null default 10 check (reservation_ttl_minutes between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_usage_rate_limits enable row level security;
revoke all on public.ai_usage_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.ai_usage_rate_limits to service_role;

create or replace function public.enforce_ai_usage_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user integer := 10;
  v_company integer := 60;
  v_concurrent integer := 5;
  v_ttl integer := 10;
begin
  if new.company_id is null then
    raise exception 'AI_COMPANY_REQUIRED';
  end if;

  select per_user_per_minute, per_company_per_minute, max_concurrent, reservation_ttl_minutes
  into v_user, v_company, v_concurrent, v_ttl
  from public.ai_usage_rate_limits
  where company_id = new.company_id;

  v_user := coalesce(v_user, 10);
  v_company := coalesce(v_company, 60);
  v_concurrent := coalesce(v_concurrent, 5);
  v_ttl := coalesce(v_ttl, 10);

  if new.user_id is not null and (
    select count(*) from public.ai_usage_events
    where company_id = new.company_id
      and user_id = new.user_id
      and created_at >= now() - interval '1 minute'
  ) >= v_user then
    raise exception 'AI_RATE_LIMITED_USER';
  end if;

  if (
    select count(*) from public.ai_usage_events
    where company_id = new.company_id
      and created_at >= now() - interval '1 minute'
  ) >= v_company then
    raise exception 'AI_RATE_LIMITED_COMPANY';
  end if;

  if (
    select count(*) from public.ai_usage_events
    where company_id = new.company_id
      and status = 'reserved'
      and created_at >= now() - make_interval(mins => v_ttl)
  ) >= v_concurrent then
    raise exception 'AI_CONCURRENCY_LIMITED';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_ai_usage_rate_limit() from public, anon, authenticated;
grant execute on function public.enforce_ai_usage_rate_limit() to service_role;

drop trigger if exists trg_ai_usage_rate_limit on public.ai_usage_events;
create trigger trg_ai_usage_rate_limit
before insert on public.ai_usage_events
for each row execute function public.enforce_ai_usage_rate_limit();
