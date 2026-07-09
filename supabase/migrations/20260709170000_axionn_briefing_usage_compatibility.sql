-- Axionn Briefing - compatibilidade temporaria com a Edge Function v1.
-- Permite que a versao publicada com os nomes genericos utilize a governanca
-- SaaS nova sem depender de um novo deploy imediato.

create or replace function public.reserve_ai_usage(
  p_team_id uuid,
  p_user_id uuid,
  p_feature text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  if p_feature <> 'ai.briefing' then
    raise exception using errcode = '22023', message = 'AI_FEATURE_NOT_SUPPORTED';
  end if;

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_org_id
  from public.teams team
  where team.id = p_team_id;

  if not found or v_org_id is null then
    raise exception using errcode = '22023', message = 'AI_BRIEFING_TEAM_ORG_REQUIRED';
  end if;

  return public.reserve_ai_briefing_usage(
    v_org_id,
    p_team_id,
    p_user_id,
    p_request_id
  );
end;
$$;

create or replace function public.finalize_ai_usage(
  p_request_id uuid,
  p_status text,
  p_provider_id uuid default null,
  p_error_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.finalize_ai_briefing_usage(
    p_request_id,
    p_status,
    p_provider_id,
    p_error_code,
    p_metadata
  );
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.reserve_ai_usage(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  to service_role;

comment on function public.reserve_ai_usage(uuid, uuid, text, uuid) is
  'Adaptador temporario da Edge Function v1 para reserve_ai_briefing_usage.';
