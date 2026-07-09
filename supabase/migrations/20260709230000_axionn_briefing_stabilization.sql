-- Axionn Briefing - estabilizacao de retencao e backoffice.
-- Corrige pontos descobertos apos a primeira rodada de integracao:
-- - aplica retencao padrao em novos briefings;
-- - arquiva expirados sem usar aggregate em RETURNING;
-- - respeita auto_anonymize no arquivamento automatico;
-- - corrige o relatorio por organizacao do backoffice.

create or replace function public.apply_ai_briefing_retention_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config public.ai_briefing_retention_config%rowtype;
  v_days integer;
begin
  select * into v_config
  from public.ai_briefing_retention_config
  where org_id = new.org_id;

  v_days := coalesce(
    new.retention_days,
    v_config.default_retention_days,
    180
  );

  new.retention_days := v_days;
  new.retention_until := coalesce(
    new.retention_until,
    now() + make_interval(days => v_days)
  );

  return new;
end;
$$;

drop trigger if exists trg_ai_briefings_retention_defaults
  on public.ai_briefings;
create trigger trg_ai_briefings_retention_defaults
before insert on public.ai_briefings
for each row execute function public.apply_ai_briefing_retention_defaults();

create or replace function public.archive_expired_briefings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  update public.ai_suggestion_evidence evidence
  set quote_text = '[ANONIMIZADO]',
      speaker_name = null
  from public.ai_briefing_suggestions suggestion
  join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
  join public.ai_briefing_retention_config config on config.org_id = briefing.org_id
  where evidence.suggestion_id = suggestion.id
    and briefing.status <> 'archived'
    and briefing.retention_until is not null
    and briefing.retention_until < now()
    and config.auto_archive
    and config.auto_anonymize;

  update public.ai_briefings briefing
  set status = 'archived',
      archived_at = coalesce(briefing.archived_at, now()),
      source_content = case
        when config.auto_anonymize then '[ANONIMIZADO]'
        else briefing.source_content
      end,
      participants = case
        when config.auto_anonymize then '[]'::jsonb
        else briefing.participants
      end,
      language = case
        when config.auto_anonymize then null
        else briefing.language
      end,
      anonymized_at = case
        when config.auto_anonymize then coalesce(briefing.anonymized_at, now())
        else briefing.anonymized_at
      end
  from public.ai_briefing_retention_config config
  where config.org_id = briefing.org_id
    and config.auto_archive
    and briefing.status <> 'archived'
    and briefing.retention_until is not null
    and briefing.retention_until < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_briefing_backoffice_by_organization()
returns table (
  org_id uuid,
  org_name text,
  plan_code text,
  total_briefings bigint,
  total_runs bigint,
  total_suggestions bigint,
  total_applied bigint,
  total_tokens bigint,
  total_cost numeric,
  current_month_runs bigint,
  monthly_limit bigint,
  runs_remaining bigint,
  suggestion_rate numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_backoffice_staff() then
    raise exception using errcode = '42501', message = 'backoffice_access_denied';
  end if;

  return query
  with org_stats as (
    select
      briefing.org_id,
      count(distinct briefing.id)::bigint as total_briefings,
      count(distinct run.id)::bigint as total_runs,
      count(distinct suggestion.id)::bigint as total_suggestions,
      count(distinct application.id)::bigint as total_applied,
      coalesce(sum(coalesce(run.input_tokens, 0) + coalesce(run.output_tokens, 0)), 0)::bigint as total_tokens,
      coalesce(sum(coalesce(run.estimated_cost, 0)), 0)::numeric as total_cost,
      count(distinct run.id) filter (
        where run.created_at >= date_trunc('month', now())
      )::bigint as current_month_runs
    from public.ai_briefings briefing
    left join public.ai_briefing_runs run on run.briefing_id = briefing.id
    left join public.ai_briefing_suggestions suggestion on suggestion.briefing_id = briefing.id
    left join public.ai_suggestion_applications application on application.suggestion_id = suggestion.id
    group by briefing.org_id
  )
  select
    org_stats.org_id,
    coalesce(org.name, 'N/A') as org_name,
    coalesce(plan.code, 'N/A') as plan_code,
    org_stats.total_briefings,
    org_stats.total_runs,
    org_stats.total_suggestions,
    org_stats.total_applied,
    org_stats.total_tokens,
    org_stats.total_cost,
    org_stats.current_month_runs,
    limits.monthly_limit,
    case
      when limits.monthly_limit is null then null
      else greatest(limits.monthly_limit - org_stats.current_month_runs, 0)
    end as runs_remaining,
    case
      when org_stats.total_suggestions > 0
        then round(org_stats.total_applied::numeric / org_stats.total_suggestions * 100, 1)
      else 0
    end as suggestion_rate
  from org_stats
  left join public.organizations org on org.id = org_stats.org_id
  left join public.saas_plans plan on plan.id = org.plan_id
  left join lateral (
    select entitlement.limit_value as monthly_limit
    from public.get_effective_organization_entitlements(org_stats.org_id) entitlement
    where entitlement.feature_key = 'ai.briefing.runs.monthly'
      and entitlement.enabled
    limit 1
  ) limits on true
  order by org_stats.total_cost desc, org_name;
end;
$$;

revoke all on function public.apply_ai_briefing_retention_defaults()
  from public, anon, authenticated;

grant execute on function public.apply_ai_briefing_retention_defaults()
  to service_role;

comment on function public.apply_ai_briefing_retention_defaults() is
  'Aplica retention_days e retention_until padrao em novos briefings.';
