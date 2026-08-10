-- APF Etapa 3 / M4: tenant-aware RLS, minimal grants, lifecycle RPCs and audit.

create or replace function public.apf_can_access_contract(p_contract_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null and (
    public.has_role(p_user_id, 'admin'::public.app_role)
    or public.is_contract_member(p_user_id, p_contract_id)
    or exists (select 1 from public.user_contracts link where link.user_id = p_user_id and link.contract_id = p_contract_id)
    or exists (
      select 1 from public.contracts contract
      join public.organization_members member on member.org_id = contract.org_id
      where contract.id = p_contract_id and member.user_id = p_user_id and member.is_active
    )
  );
$$;

create or replace function public.apf_can_edit_contract(p_contract_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null and (
    public.has_role(p_user_id, 'admin'::public.app_role)
    or exists (
      select 1 from public.contracts contract
      where contract.id = p_contract_id and public.is_organization_admin(contract.org_id, p_user_id)
    )
    or exists (select 1 from public.user_contracts link where link.user_id = p_user_id and link.contract_id = p_contract_id)
  );
$$;

create or replace function public.apf_can_publish_profile(p_profile_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null and exists (
    select 1 from public.apf_profiles profile
    join public.contracts contract on contract.id = profile.contract_id
    where profile.id = p_profile_id
      and public.is_organization_admin(contract.org_id, p_user_id)
  );
$$;

create or replace function public.apf_can_read_profile(p_profile_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.apf_profiles profile
    where profile.id = p_profile_id and public.apf_can_access_contract(profile.contract_id, p_user_id)
  );
$$;

create or replace function public.apf_can_read_version(p_version_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.apf_profile_versions version
    where version.id = p_version_id and public.apf_can_read_profile(version.profile_id, p_user_id)
  );
$$;

create or replace function public.apf_can_edit_version(p_version_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.apf_profile_versions version
    join public.apf_profiles profile on profile.id = version.profile_id
    where version.id = p_version_id and version.status = 'draft'
      and public.apf_can_edit_contract(profile.contract_id, p_user_id)
  );
$$;

do $$
declare
  v_function regprocedure;
begin
  foreach v_function in array array[
    'public.apf_can_access_contract(uuid,uuid)'::regprocedure,
    'public.apf_can_edit_contract(uuid,uuid)'::regprocedure,
    'public.apf_can_publish_profile(uuid,uuid)'::regprocedure,
    'public.apf_can_read_profile(uuid,uuid)'::regprocedure,
    'public.apf_can_read_version(uuid,uuid)'::regprocedure,
    'public.apf_can_edit_version(uuid,uuid)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon', v_function);
    execute format('grant execute on function %s to authenticated, service_role', v_function);
  end loop;
end $$;

alter table public.apf_profiles enable row level security;
alter table public.apf_profile_versions enable row level security;
alter table public.apf_profile_rulesets enable row level security;
alter table public.apf_profile_function_types enable row level security;
alter table public.apf_profile_function_weights enable row level security;
alter table public.apf_profile_factors enable row level security;
alter table public.apf_profile_maintenance_rules enable row level security;
alter table public.apf_profile_precedence_rules enable row level security;

create policy apf_profiles_select on public.apf_profiles for select to authenticated
using (public.apf_can_access_contract(contract_id));
create policy apf_profiles_insert on public.apf_profiles for insert to authenticated
with check (public.apf_can_edit_contract(contract_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy apf_profiles_update on public.apf_profiles for update to authenticated
using (public.apf_can_edit_contract(contract_id))
with check (public.apf_can_edit_contract(contract_id) and updated_by = auth.uid());

create policy apf_profile_versions_select on public.apf_profile_versions for select to authenticated
using (public.apf_can_read_profile(profile_id));
create policy apf_profile_versions_insert on public.apf_profile_versions for insert to authenticated
with check (
  status = 'draft'
  and exists (
    select 1 from public.apf_profiles profile
    where profile.id = apf_profile_versions.profile_id and public.apf_can_edit_contract(profile.contract_id)
  )
  and created_by = auth.uid() and updated_by = auth.uid()
);
create policy apf_profile_versions_update_draft on public.apf_profile_versions for update to authenticated
using (public.apf_can_edit_version(id))
with check (status = 'draft' and public.apf_can_edit_version(id) and updated_by = auth.uid());

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'apf_profile_rulesets', 'apf_profile_function_types', 'apf_profile_function_weights',
    'apf_profile_factors', 'apf_profile_maintenance_rules', 'apf_profile_precedence_rules'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.apf_can_read_version(profile_version_id))', v_table || '_select', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.apf_can_edit_version(profile_version_id))', v_table || '_insert', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (public.apf_can_edit_version(profile_version_id)) with check (public.apf_can_edit_version(profile_version_id))', v_table || '_update', v_table);
    execute format('revoke all on table public.%I from public, anon', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
    execute format('grant all on table public.%I to service_role', v_table);
  end loop;
end $$;

revoke all on table public.apf_profiles, public.apf_profile_versions from public, anon;
grant select, insert, update on table public.apf_profiles, public.apf_profile_versions to authenticated;
grant all on table public.apf_profiles, public.apf_profile_versions to service_role;

create table if not exists public.apf_profile_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  profile_id uuid not null references public.apf_profiles(id) on delete restrict,
  profile_version_id uuid references public.apf_profile_versions(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  reason text,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id) on delete restrict,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  constraint apf_profile_audit_action_check check (action in ('insert', 'update', 'delete', 'transition', 'publish', 'retire'))
);

create index if not exists apf_profile_audit_profile_time_idx
  on public.apf_profile_audit_events(profile_id, created_at desc);
create index if not exists apf_profile_audit_contract_time_idx
  on public.apf_profile_audit_events(contract_id, created_at desc);
create index if not exists apf_profile_audit_version_idx
  on public.apf_profile_audit_events(profile_version_id) where profile_version_id is not null;

alter table public.apf_profile_audit_events enable row level security;
create policy apf_profile_audit_select on public.apf_profile_audit_events for select to authenticated
using (public.apf_can_read_profile(profile_id));
revoke all on table public.apf_profile_audit_events from public, anon, authenticated;
grant select on table public.apf_profile_audit_events to authenticated;
grant all on table public.apf_profile_audit_events to service_role;

create or replace function public.apf_audit_versioned_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_profile_id uuid;
  v_version_id uuid;
  v_contract_id uuid;
  v_org_id uuid;
begin
  if tg_table_name = 'apf_profiles' then
    v_profile_id := (v_row->>'id')::uuid;
  elsif tg_table_name = 'apf_profile_versions' then
    v_version_id := (v_row->>'id')::uuid;
    v_profile_id := (v_row->>'profile_id')::uuid;
  else
    v_version_id := (v_row->>'profile_version_id')::uuid;
    select version.profile_id into v_profile_id from public.apf_profile_versions version where version.id = v_version_id;
  end if;
  select profile.contract_id, contract.org_id into v_contract_id, v_org_id
  from public.apf_profiles profile join public.contracts contract on contract.id = profile.contract_id
  where profile.id = v_profile_id;

  insert into public.apf_profile_audit_events(
    organization_id, contract_id, profile_id, profile_version_id,
    entity_type, entity_id, action, old_data, new_data, actor_id
  ) values (
    v_org_id, v_contract_id, v_profile_id, v_version_id,
    tg_table_name, (v_row->>'id')::uuid, lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.apf_audit_versioned_configuration() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'apf_profiles', 'apf_profile_versions', 'apf_profile_rulesets',
    'apf_profile_function_types', 'apf_profile_function_weights', 'apf_profile_factors',
    'apf_profile_maintenance_rules', 'apf_profile_precedence_rules'
  ] loop
    execute format('drop trigger if exists apf_configuration_audit on public.%I', v_table);
    execute format('create trigger apf_configuration_audit after insert or update or delete on public.%I for each row execute function public.apf_audit_versioned_configuration()', v_table);
  end loop;
end $$;

create or replace function public.transition_apf_profile_version(
  p_version_id uuid,
  p_expected_revision bigint,
  p_to_status text,
  p_reason text
)
returns public.apf_profile_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.apf_profile_versions%rowtype;
  v_editor boolean;
  v_publisher boolean;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'apf_authentication_required'; end if;
  select version.* into v_version from public.apf_profile_versions version where version.id = p_version_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'apf_profile_version_not_found'; end if;
  if v_version.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'apf_profile_version_revision_conflict'; end if;
  v_editor := public.apf_can_edit_contract((select contract_id from public.apf_profiles where id = v_version.profile_id));
  v_publisher := public.apf_can_publish_profile(v_version.profile_id);
  if (v_version.status, p_to_status) in (('draft','in_review'), ('in_review','draft')) and not v_editor then
    raise exception using errcode = '42501', message = 'apf_profile_version_edit_forbidden';
  elsif (v_version.status, p_to_status) in (('in_review','approved'), ('approved','draft')) and not v_publisher then
    raise exception using errcode = '42501', message = 'apf_profile_version_approval_forbidden';
  elsif (v_version.status, p_to_status) not in (('draft','in_review'), ('in_review','draft'), ('in_review','approved'), ('approved','draft')) then
    raise exception using errcode = '22023', message = 'apf_profile_version_transition_invalid';
  end if;

  update public.apf_profile_versions
  set status = p_to_status,
      updated_by = auth.uid(),
      reviewed_by = case when p_to_status = 'in_review' then auth.uid() else reviewed_by end,
      reviewed_at = case when p_to_status = 'in_review' then now() else reviewed_at end,
      approved_by = case when p_to_status = 'approved' then auth.uid() when p_to_status = 'draft' then null else approved_by end,
      approved_at = case when p_to_status = 'approved' then now() when p_to_status = 'draft' then null else approved_at end
  where id = p_version_id returning * into v_version;

  insert into public.apf_profile_audit_events(organization_id, contract_id, profile_id, profile_version_id, entity_type, entity_id, action, reason, actor_id)
  select contract.org_id, profile.contract_id, profile.id, v_version.id, 'apf_profile_versions', v_version.id, 'transition', p_reason, auth.uid()
  from public.apf_profiles profile join public.contracts contract on contract.id = profile.contract_id where profile.id = v_version.profile_id;
  return v_version;
end;
$$;

create or replace function public.publish_apf_profile_version(
  p_version_id uuid,
  p_expected_revision bigint,
  p_reason text
)
returns public.apf_profile_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.apf_profile_versions%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'apf_authentication_required'; end if;
  select version.* into v_version from public.apf_profile_versions version where version.id = p_version_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'apf_profile_version_not_found'; end if;
  if v_version.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'apf_profile_version_revision_conflict'; end if;
  if not public.apf_can_publish_profile(v_version.profile_id) then raise exception using errcode = '42501', message = 'apf_profile_version_publish_forbidden'; end if;
  update public.apf_profile_versions
  set status = 'published', published_by = auth.uid(), published_at = now(), updated_by = auth.uid()
  where id = p_version_id returning * into v_version;
  insert into public.apf_profile_audit_events(organization_id, contract_id, profile_id, profile_version_id, entity_type, entity_id, action, reason, actor_id)
  select contract.org_id, profile.contract_id, profile.id, v_version.id, 'apf_profile_versions', v_version.id, 'publish', p_reason, auth.uid()
  from public.apf_profiles profile join public.contracts contract on contract.id = profile.contract_id where profile.id = v_version.profile_id;
  return v_version;
end;
$$;

create or replace function public.retire_apf_profile_version(
  p_version_id uuid,
  p_expected_revision bigint,
  p_reason text
)
returns public.apf_profile_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.apf_profile_versions%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'apf_authentication_required'; end if;
  select version.* into v_version from public.apf_profile_versions version where version.id = p_version_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'apf_profile_version_not_found'; end if;
  if v_version.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'apf_profile_version_revision_conflict'; end if;
  if v_version.status <> 'published' then raise exception using errcode = '22023', message = 'apf_profile_version_not_published'; end if;
  if not public.apf_can_publish_profile(v_version.profile_id) then raise exception using errcode = '42501', message = 'apf_profile_version_retire_forbidden'; end if;
  update public.apf_profile_versions
  set status = 'retired', retired_by = auth.uid(), retired_at = now(), updated_by = auth.uid()
  where id = p_version_id returning * into v_version;
  insert into public.apf_profile_audit_events(organization_id, contract_id, profile_id, profile_version_id, entity_type, entity_id, action, reason, actor_id)
  select contract.org_id, profile.contract_id, profile.id, v_version.id, 'apf_profile_versions', v_version.id, 'retire', p_reason, auth.uid()
  from public.apf_profiles profile join public.contracts contract on contract.id = profile.contract_id where profile.id = v_version.profile_id;
  return v_version;
end;
$$;

revoke all on function public.transition_apf_profile_version(uuid,bigint,text,text) from public, anon;
revoke all on function public.publish_apf_profile_version(uuid,bigint,text) from public, anon;
revoke all on function public.retire_apf_profile_version(uuid,bigint,text) from public, anon;
grant execute on function public.transition_apf_profile_version(uuid,bigint,text,text) to authenticated;
grant execute on function public.publish_apf_profile_version(uuid,bigint,text) to authenticated;
grant execute on function public.retire_apf_profile_version(uuid,bigint,text) to authenticated;
