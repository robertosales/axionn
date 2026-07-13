-- Axionn Briefing - politica de retencao, privacidade e arquivamento automatico.
-- Briefings podem conter conversas sensiveis; esta migration define:
-- - prazo de retencao por organizacao
-- - arquivamento automatico de briefings expirados
-- - anonimizacao de evidencias e transcricoes
-- - controle de exclusao por papel

alter table public.ai_briefings
  add column if not exists retention_days integer
    check (retention_days is null or retention_days between 1 and 3650),
  add column if not exists archived_at timestamptz,
  add column if not exists anonymized_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_ai_briefings_retention
  on public.ai_briefings(retention_until)
  where status <> 'archived' and retention_until is not null;

create table if not exists public.ai_briefing_retention_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  default_retention_days integer not null default 180
    check (default_retention_days between 1 and 3650),
  auto_archive boolean not null default true,
  auto_anonymize boolean not null default false,
  allow_permanent_delete boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create or replace function public.touch_retention_config_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_briefing_retention_config_updated_at
  on public.ai_briefing_retention_config;
create trigger trg_ai_briefing_retention_config_updated_at
before update on public.ai_briefing_retention_config
for each row execute function public.touch_retention_config_updated_at();

create or replace function public.archive_expired_briefings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.ai_briefings
  set status = 'archived',
      archived_at = now()
  where status <> 'archived'
    and retention_until is not null
    and retention_until < now()
  returning count(*) into v_count;

  return v_count;
end;
$$;

create or replace function public.set_org_briefing_retention(
  p_org_id uuid,
  p_default_retention_days integer,
  p_auto_archive boolean default true,
  p_auto_anonymize boolean default false,
  p_allow_permanent_delete boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'retention_config_access_denied';
  end if;

  insert into public.ai_briefing_retention_config (
    org_id, default_retention_days, auto_archive,
    auto_anonymize, allow_permanent_delete, created_by
  )
  values (
    p_org_id, p_default_retention_days, p_auto_archive,
    p_auto_anonymize, p_allow_permanent_delete, auth.uid()
  )
  on conflict (org_id) do update
  set default_retention_days = excluded.default_retention_days,
      auto_archive = excluded.auto_archive,
      auto_anonymize = excluded.auto_anonymize,
      allow_permanent_delete = excluded.allow_permanent_delete;
end;
$$;

create or replace function public.get_org_briefing_retention_config(
  p_org_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'org_id', config.org_id,
    'default_retention_days', config.default_retention_days,
    'auto_archive', config.auto_archive,
    'auto_anonymize', config.auto_anonymize,
    'allow_permanent_delete', config.allow_permanent_delete
  )
  from public.ai_briefing_retention_config config
  where config.org_id = p_org_id;
$$;

create or replace function public.anonymize_ai_briefing(
  p_briefing_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id
  from public.ai_briefings
  where id = p_briefing_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_not_found';
  end if;

  if auth.uid() is null
     or not public.is_organization_admin(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_anonymize_access_denied';
  end if;

  update public.ai_briefings
  set source_content = '[ANONIMIZADO]',
      participants = '[]'::jsonb,
      language = null,
      anonymized_at = now()
  where id = p_briefing_id;

  update public.ai_suggestion_evidence evidence
  set quote_text = '[ANONIMIZADO]',
      speaker_name = null
  from public.ai_briefing_suggestions suggestion
  where suggestion.briefing_id = p_briefing_id
    and evidence.suggestion_id = suggestion.id;
end;
$$;

create or replace function public.delete_ai_briefing(
  p_briefing_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_config public.ai_briefing_retention_config%rowtype;
begin
  select org_id into v_org_id
  from public.ai_briefings
  where id = p_briefing_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_not_found';
  end if;

  if auth.uid() is null
     or not public.is_organization_admin(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_delete_access_denied';
  end if;

  select * into v_config
  from public.ai_briefing_retention_config
  where org_id = v_org_id;

  if not found or not v_config.allow_permanent_delete then
    update public.ai_briefings
    set status = 'archived',
        archived_at = now(),
        deleted_at = now(),
        source_content = '[EXCLUIDO]',
        participants = '[]'::jsonb
    where id = p_briefing_id;
    return;
  end if;

  delete from public.ai_suggestion_evidence evidence
  using public.ai_briefing_suggestions suggestion
  where suggestion.briefing_id = p_briefing_id
    and evidence.suggestion_id = suggestion.id;

  delete from public.ai_suggestion_applications application
  using public.ai_briefing_suggestions suggestion
  where suggestion.briefing_id = p_briefing_id
    and application.suggestion_id = suggestion.id;

  delete from public.ai_briefing_suggestions
  where briefing_id = p_briefing_id;

  delete from public.ai_briefing_runs
  where briefing_id = p_briefing_id;

  delete from public.ai_briefings
  where id = p_briefing_id;
end;
$$;

revoke all on function public.archive_expired_briefings()
  from public, anon, authenticated;
grant execute on function public.archive_expired_briefings()
  to service_role;

revoke all on function public.set_org_briefing_retention(uuid, integer, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.set_org_briefing_retention(uuid, integer, boolean, boolean, boolean)
  to authenticated, service_role;

revoke all on function public.get_org_briefing_retention_config(uuid)
  from public, anon;
grant execute on function public.get_org_briefing_retention_config(uuid)
  to authenticated, service_role;

revoke all on function public.anonymize_ai_briefing(uuid)
  from public, anon;
grant execute on function public.anonymize_ai_briefing(uuid)
  to authenticated, service_role;

revoke all on function public.delete_ai_briefing(uuid)
  from public, anon;
grant execute on function public.delete_ai_briefing(uuid)
  to authenticated, service_role;

comment on table public.ai_briefing_retention_config is
  'Configuracao de retencao e privacidade por organizacao.';
comment on function public.archive_expired_briefings() is
  'Arquiva automaticamente briefings cujo retention_until ja passou. Pode ser chamado por cron.';
comment on function public.anonymize_ai_briefing(uuid) is
  'Anonimiza transcricao e evidencias de um briefing, mantendo apenas estrutura para auditoria.';
comment on function public.delete_ai_briefing(uuid) is
  'Exclusao segura: soft-delete por padrao, hard-delete apenas se configuracao permitir.';
