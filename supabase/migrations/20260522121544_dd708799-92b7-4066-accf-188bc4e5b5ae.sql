-- AI Providers dinâmicos, compatível com instalações onde a tabela já existe.

begin;

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type text not null,
  model text,
  is_recommended boolean not null default false,
  is_active boolean not null default true,
  has_key boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_providers
  add column if not exists model text,
  add column if not exists is_recommended boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists has_key boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists ai_providers_active_idx
  on public.ai_providers(is_active);

alter table public.ai_providers enable row level security;

drop policy if exists "Authenticated can read active ai_providers" on public.ai_providers;
create policy "Authenticated can read active ai_providers"
on public.ai_providers for select to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins insert ai_providers" on public.ai_providers;
create policy "Admins insert ai_providers"
on public.ai_providers for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins update ai_providers" on public.ai_providers;
create policy "Admins update ai_providers"
on public.ai_providers for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete ai_providers" on public.ai_providers;
create policy "Admins delete ai_providers"
on public.ai_providers for delete to authenticated
using (public.is_admin());

create or replace function public.ai_providers_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_providers_touch on public.ai_providers;
create trigger ai_providers_touch
before update on public.ai_providers
for each row execute function public.ai_providers_touch_updated_at();

create or replace function public.set_ai_provider_key_v2(
  p_id uuid,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_name text := 'ai_provider_key_' || p_id::text;
  v_existing_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem configurar API keys';
  end if;

  if not exists (select 1 from public.ai_providers where id = p_id) then
    raise exception 'Provedor de IA não encontrado: %', p_id;
  end if;

  if p_key is null or length(trim(p_key)) < 10 then
    raise exception 'API key inválida ou muito curta';
  end if;

  if to_regclass('vault.secrets') is null then
    raise exception 'vault_unavailable';
  end if;

  select secret.id
    into v_existing_id
    from vault.secrets secret
   where secret.name = v_secret_name
   limit 1;

  if v_existing_id is not null then
    perform vault.update_secret(v_existing_id, p_key);
  else
    perform vault.create_secret(
      p_key,
      v_secret_name,
      'AI provider key for row ' || p_id::text
    );
  end if;

  update public.ai_providers
     set has_key = true,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.set_ai_provider_key_v2(uuid, text) from public;
grant execute on function public.set_ai_provider_key_v2(uuid, text) to authenticated;

create or replace function public.get_ai_provider_key_by_id(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'vault_unavailable';
  end if;

  select secret.decrypted_secret
    into v_key
    from vault.decrypted_secrets secret
   where secret.name = 'ai_provider_key_' || p_id::text
   limit 1;

  return v_key;
end;
$$;

revoke all on function public.get_ai_provider_key_by_id(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_provider_key_by_id(uuid) to service_role;

create or replace function public.delete_ai_provider_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem remover API keys';
  end if;

  if to_regclass('vault.secrets') is null then
    raise exception 'vault_unavailable';
  end if;

  delete from vault.secrets
   where name = 'ai_provider_key_' || p_id::text;
end;
$$;

revoke all on function public.delete_ai_provider_key(uuid) from public;
grant execute on function public.delete_ai_provider_key(uuid) to authenticated;

insert into public.ai_providers (
  name,
  provider_type,
  model,
  is_recommended,
  is_active,
  has_key
)
select
  'Lovable AI (Gemini/GPT) — recomendado',
  'lovable',
  'google/gemini-2.5-flash',
  true,
  true,
  true
where not exists (
  select 1
  from public.ai_providers
  where provider_type = 'lovable'
);

commit;
