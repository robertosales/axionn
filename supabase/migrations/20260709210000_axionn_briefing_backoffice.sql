-- Axionn Briefing - visao de gestao/backoffice.
-- Relatorios consolidados de uso, custos, taxa de aplicacao e limites por organizacao.

create or replace function public.get_briefing_backoffice_summary()
returns table (
  total_organizations bigint,
  total_teams bigint,
  total_briefings bigint,
  total_ai_runs bigint,
  total_suggestions bigint,
  total_applied bigint,
  total_failed bigint,
  total_usage_events bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  total_estimated_cost numeric,
  avg_duration_ms numeric,
  suggestion_approval_rate numeric,
  current_month_runs bigint,
  current_month_cost numeric
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
  select
    (select count(distinct org_id) from public.ai_briefings)::bigint,
    (select count(distinct team_id) from public.ai_briefings where team_id is not null)::bigint,
    (select count(*) from public.ai_briefings)::bigint,
    (select count(*) from public.ai_briefing_runs)::bigint,
    (select count(*) from public.ai_briefing_suggestions)::bigint,
    (select count(*) from public.ai_suggestion_applications)::bigint,
    (select count(*) from public.ai_briefing_runs where status = 'failed')::bigint,
    (select count(*) from public.ai_usage_events where feature = 'ai.briefing')::bigint,

    coalesce((select sum(input_tokens) from public.ai_briefing_runs where status = 'success'), 0)::bigint,
    coalesce((select sum(output_tokens) from public.ai_briefing_runs where status = 'success'), 0)::bigint,
    coalesce((select sum(estimated_cost) from public.ai_briefing_runs where status = 'success'), 0)::numeric,

    coalesce((select round(avg(duration_ms)) from public.ai_briefing_runs where status = 'success'), 0)::numeric,

    case
      when (select count(*) from public.ai_briefing_suggestions) > 0
      then round(
        (select count(*)::numeric from public.ai_briefing_suggestions
         where review_status in ('approved', 'edited', 'applied'))
        / (select count(*)::numeric from public.ai_briefing_suggestions) * 100, 1
      )
      else 0
    end::numeric,

    (select count(*) from public.ai_briefing_runs
     where created_at >= date_trunc('month', now()))::bigint,

    coalesce((select sum(estimated_cost) from public.ai_briefing_runs
     where status = 'success'
       and created_at >= date_trunc('month', now())), 0)::numeric;
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
      count(distinct briefing.id) as total_briefings,
      count(distinct run.id) as total_runs,
      count(distinct suggestion.id) as total_suggestions,
      count(distinct application.id) as total_applied,
      coalesce(sum(run.input_tokens + run.output_tokens), 0) as total_tokens,
      coalesce(sum(run.estimated_cost), 0) as total_cost,
      count(distinct run.id) filter (
        where run.created_at >= date_trunc('month', now())
      ) as current_month_runs
    from public.ai_briefings briefing
    left join public.ai_briefing_runs run on run.briefing_id = briefing.id
    left join public.ai_briefing_suggestions suggestion on suggestion.briefing_id = briefing.id
    left join public.ai_suggestion_applications application on application.suggestion_id = suggestion.id
    group by briefing.org_id
  ),
  org_limits as (
    select
      entitlement.org_id,
      entitlement.limit_value as monthly_limit
    from public.get_effective_organization_entitlements(org_stats.org_id) entitlement
    where entitlement.feature_key = 'ai.briefing.runs.monthly'
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
    org_limits.monthly_limit,
    case
      when org_limits.monthly_limit is null then null
      else greatest(org_limits.monthly_limit - org_stats.current_month_runs, 0)
    end as runs_remaining,
    case
      when org_stats.total_suggestions > 0
      then round(org_stats.total_applied::numeric / org_stats.total_suggestions * 100, 1)
      else 0
    end as suggestion_rate
  from org_stats
  left join public.organizations org on org.id = org_stats.org_id
  left join public.saas_plans plan on plan.id = org.plan_id
  left join org_limits on org_limits.org_id = org_stats.org_id
  order by org_stats.total_cost desc;
end;
$$;

create or replace function public.get_briefing_backoffice_by_provider()
returns table (
  provider_id uuid,
  provider_name text,
  provider_type text,
  total_runs bigint,
  success_runs bigint,
  failed_runs bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  total_cost numeric,
  avg_duration_ms numeric,
  avg_cost_per_run numeric
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
  select
    provider.id,
    provider.name,
    provider.provider_type,
    count(run.id)::bigint,
    count(run.id) filter (where run.status = 'success')::bigint,
    count(run.id) filter (where run.status = 'failed')::bigint,
    coalesce(sum(run.input_tokens), 0)::bigint,
    coalesce(sum(run.output_tokens), 0)::bigint,
    coalesce(sum(run.estimated_cost), 0)::numeric,
    coalesce(round(avg(run.duration_ms)), 0)::numeric,
    case
      when count(run.id) > 0
      then round(coalesce(sum(run.estimated_cost), 0) / count(run.id), 4)
      else 0
    end::numeric
  from public.ai_providers provider
  left join public.ai_briefing_runs run on run.provider_id = provider.id
  group by provider.id, provider.name, provider.provider_type
  having count(run.id) > 0
  order by total_cost desc;
end;
$$;

create or replace function public.get_briefing_backoffice_team_summary(
  p_org_id uuid default null
)
returns table (
  team_id uuid,
  team_name text,
  org_name text,
  total_briefings bigint,
  total_suggestions bigint,
  total_applied bigint,
  pending_review bigint,
  overdue_items bigint,
  total_cost numeric
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
  select
    team.id,
    team.name,
    coalesce(org.name, 'N/A'),
    count(distinct briefing.id)::bigint,
    count(distinct suggestion.id)::bigint,
    count(distinct application.id)::bigint,
    count(distinct suggestion.id) filter (
      where suggestion.review_status = 'pending'
    )::bigint,
    count(distinct suggestion.id) filter (
      where suggestion.review_status in ('pending', 'approved', 'edited')
        and case
          when suggestion.review_status = 'edited'
            then nullif(suggestion.reviewed_payload ->> 'dueDate', '')::date
          else suggestion.suggested_due_date
        end < current_date
    )::bigint,
    coalesce(sum(run.estimated_cost), 0)::numeric
  from public.teams team
  join public.ai_briefings briefing on briefing.team_id = team.id
  left join public.organizations org on org.id = team.org_id
  left join public.ai_briefing_runs run on run.briefing_id = briefing.id
  left join public.ai_briefing_suggestions suggestion on suggestion.briefing_id = briefing.id
  left join public.ai_suggestion_applications application on application.suggestion_id = suggestion.id
  where (p_org_id is null or team.org_id = p_org_id)
  group by team.id, team.name, org.name
  order by total_cost desc;
end;
$$;

revoke all on function public.get_briefing_backoffice_summary()
  from public, anon, authenticated;
revoke all on function public.get_briefing_backoffice_by_organization()
  from public, anon, authenticated;
revoke all on function public.get_briefing_backoffice_by_provider()
  from public, anon, authenticated;
revoke all on function public.get_briefing_backoffice_team_summary(uuid)
  from public, anon, authenticated;

grant execute on function public.get_briefing_backoffice_summary()
  to authenticated, service_role;
grant execute on function public.get_briefing_backoffice_by_organization()
  to authenticated, service_role;
grant execute on function public.get_briefing_backoffice_by_provider()
  to authenticated, service_role;
grant execute on function public.get_briefing_backoffice_team_summary(uuid)
  to authenticated, service_role;

comment on function public.get_briefing_backoffice_summary() is
  'Indicadores consolidados do modulo Briefing IA para o backoffice.';
comment on function public.get_briefing_backoffice_by_organization() is
  'Uso do Briefing IA detalhado por organizacao, com limites do plano.';
comment on function public.get_briefing_backoffice_by_provider() is
  'Custo e desempenho por provedor de IA usado nos processamentos.';
comment on function public.get_briefing_backoffice_team_summary(uuid) is
  'Resumo por equipe, filtrado por organizacao quando especificado.';
