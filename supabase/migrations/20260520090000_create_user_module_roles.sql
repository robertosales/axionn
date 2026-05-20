-- Cria tabela user_module_roles para controle de acesso por modulo
-- Esta tabela estava sendo usada no codigo mas nunca foi criada via migration

create table if not exists public.user_module_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  module     text not null,  -- 'sala_agil' | 'sustentacao' | 'rdm'
  role_name  text not null,  -- 'admin' | 'scrum_master' | 'developer' | 'member' | ...
  created_at timestamptz not null default now(),
  unique (user_id, module)
);

create index if not exists idx_user_module_roles_user_id on public.user_module_roles (user_id);
create index if not exists idx_user_module_roles_module  on public.user_module_roles (module);

alter table public.user_module_roles enable row level security;

-- Admins veem tudo
drop policy if exists "umr_admin_all" on public.user_module_roles;
create policy "umr_admin_all"
  on public.user_module_roles
  for all
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and module_access = 'admin'
    )
  );

-- Usuarios veem somente o proprio registro
drop policy if exists "umr_self_select" on public.user_module_roles;
create policy "umr_self_select"
  on public.user_module_roles
  for select
  using (user_id = auth.uid());

-- Migrar dados existentes de profiles.module_access para user_module_roles
-- (apenas para registros que ainda nao foram migrados)
insert into public.user_module_roles (user_id, module, role_name)
select
  p.user_id,
  case p.module_access
    when 'sala_agil'   then 'sala_agil'
    when 'sustentacao' then 'sustentacao'
    when 'rdm'         then 'rdm'
    when 'admin'       then 'sala_agil'  -- admin entra em sala_agil; linha extra para sustentacao abaixo
    else 'sala_agil'
  end as module,
  case p.module_access
    when 'admin' then 'admin'
    else 'member'
  end as role_name
from public.profiles p
where not exists (
  select 1 from public.user_module_roles umr
  where umr.user_id = p.user_id
)
  and p.module_access is not null
on conflict (user_id, module) do nothing;

-- Admins tambem recebem entrada em sustentacao
insert into public.user_module_roles (user_id, module, role_name)
select p.user_id, 'sustentacao', 'admin'
from public.profiles p
where p.module_access = 'admin'
  and not exists (
    select 1 from public.user_module_roles umr
    where umr.user_id = p.user_id and umr.module = 'sustentacao'
  )
on conflict (user_id, module) do nothing;
