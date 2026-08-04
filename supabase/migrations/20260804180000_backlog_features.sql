-- Hierarquia do backlog: Epic -> Feature -> User Story -> Activity
-- "backlog_features" evita conflito semantico com o catalogo comercial product_features.

create table if not exists public.backlog_features (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  epic_id uuid not null references public.epics(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  color text not null default '#0ea5e9',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_backlog_features_team_id
  on public.backlog_features(team_id);
create index if not exists idx_backlog_features_epic_id
  on public.backlog_features(epic_id);

alter table public.user_stories
  add column if not exists feature_id uuid references public.backlog_features(id) on delete set null;

create index if not exists idx_user_stories_feature_id
  on public.user_stories(feature_id);

create or replace function public.validate_backlog_hierarchy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_epic_team_id uuid;
  v_feature_team_id uuid;
  v_feature_epic_id uuid;
begin
  if tg_table_name = 'backlog_features' then
    select team_id into v_epic_team_id from public.epics where id = new.epic_id;
    if v_epic_team_id is null or v_epic_team_id <> new.team_id then
      raise exception using errcode = '23514', message = 'backlog_feature_epic_team_mismatch';
    end if;
    return new;
  end if;

  if new.feature_id is not null then
    select team_id, epic_id into v_feature_team_id, v_feature_epic_id
    from public.backlog_features where id = new.feature_id;
    if v_feature_team_id is null or v_feature_team_id <> new.team_id then
      raise exception using errcode = '23514', message = 'user_story_feature_team_mismatch';
    end if;
    if new.epic_id is null then
      new.epic_id := v_feature_epic_id;
    elsif new.epic_id <> v_feature_epic_id then
      raise exception using errcode = '23514', message = 'user_story_feature_epic_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_backlog_feature_hierarchy on public.backlog_features;
create trigger validate_backlog_feature_hierarchy
before insert or update of team_id, epic_id on public.backlog_features
for each row execute function public.validate_backlog_hierarchy();

create or replace function public.sync_backlog_feature_epic_to_stories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.epic_id is distinct from old.epic_id then
    update public.user_stories
    set epic_id = new.epic_id
    where feature_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_backlog_feature_epic_to_stories on public.backlog_features;
create trigger sync_backlog_feature_epic_to_stories
after update of epic_id on public.backlog_features
for each row execute function public.sync_backlog_feature_epic_to_stories();

drop trigger if exists validate_user_story_feature_hierarchy on public.user_stories;
create trigger validate_user_story_feature_hierarchy
before insert or update of team_id, epic_id, feature_id on public.user_stories
for each row execute function public.validate_backlog_hierarchy();

drop trigger if exists update_backlog_features_updated_at on public.backlog_features;
create trigger update_backlog_features_updated_at
before update on public.backlog_features
for each row execute function public.update_updated_at_column();

alter table public.backlog_features enable row level security;

drop policy if exists "backlog_features_select" on public.backlog_features;
create policy "backlog_features_select"
on public.backlog_features for select to authenticated
using (public.can_view_team(auth.uid(), team_id));

drop policy if exists "backlog_features_insert" on public.backlog_features;
create policy "backlog_features_insert"
on public.backlog_features for insert to authenticated
with check (public.can_view_team(auth.uid(), team_id));

drop policy if exists "backlog_features_update" on public.backlog_features;
create policy "backlog_features_update"
on public.backlog_features for update to authenticated
using (public.is_team_manager(auth.uid(), team_id))
with check (public.is_team_manager(auth.uid(), team_id));

drop policy if exists "backlog_features_delete" on public.backlog_features;
create policy "backlog_features_delete"
on public.backlog_features for delete to authenticated
using (public.is_team_manager(auth.uid(), team_id));

grant select, insert, update, delete on public.backlog_features to authenticated;

comment on table public.backlog_features is
  'Features de backlog entre epicos e historias de usuario; distinta de product_features (licenciamento).';
comment on column public.user_stories.feature_id is
  'Feature de backlog opcional. epic_id e mantido durante a transicao por compatibilidade.';
