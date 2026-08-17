-- A aplicação persiste o responsável da HU como developers.id. A migration
-- de compatibilidade anterior criou a FK para profiles(user_id), fazendo com
-- que updates de feature + responsável falhassem atomicamente.

alter table public.user_stories
  drop constraint if exists user_stories_assignee_id_fkey;

-- Converte instalações que chegaram a persistir profiles.user_id para o
-- developer canônico do mesmo usuário/time. IDs que já são developers.id
-- permanecem inalterados.
update public.user_stories as story
set assignee_id = (
  select developer.id
  from public.developers as developer
  where developer.team_id = story.team_id
    and developer.user_id = story.assignee_id
  order by developer.created_at desc nulls last, developer.id
  limit 1
)
where story.assignee_id is not null
  and not exists (
    select 1 from public.developers as developer
    where developer.id = story.assignee_id
      and developer.team_id = story.team_id
  );

alter table public.user_stories
  add constraint user_stories_assignee_id_fkey
  foreign key (assignee_id) references public.developers(id) on delete set null;

drop policy if exists "user_stories_update" on public.user_stories;
create policy "user_stories_update"
on public.user_stories for update to authenticated
using (
  public.is_team_manager(auth.uid(), team_id)
  or exists (
    select 1 from public.developers as developer
    where developer.id = user_stories.assignee_id
      and developer.user_id = auth.uid()
      and developer.team_id = user_stories.team_id
  )
)
with check (
  public.is_team_manager(auth.uid(), team_id)
  or exists (
    select 1 from public.developers as developer
    where developer.id = user_stories.assignee_id
      and developer.user_id = auth.uid()
      and developer.team_id = user_stories.team_id
  )
);

comment on column public.user_stories.assignee_id is
  'Responsável pela HU, referenciado por developers.id.';
