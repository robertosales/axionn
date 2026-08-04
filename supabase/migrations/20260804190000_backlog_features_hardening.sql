-- Hardening incremental da hierarquia de backlog.
-- Aplicar depois de 20260804180000_backlog_features.sql.

create or replace function public.prevent_linked_backlog_feature_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.user_stories where feature_id = old.id) then
    raise exception using
      errcode = '23503',
      message = 'backlog_feature_has_user_stories',
      hint = 'Desvincule ou mova as historias antes de excluir a feature.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_linked_backlog_feature_delete on public.backlog_features;
create trigger prevent_linked_backlog_feature_delete
before delete on public.backlog_features
for each row execute function public.prevent_linked_backlog_feature_delete();

-- Funcoes internas: somente os triggers devem chama-las.
revoke all on table public.backlog_features from anon;
grant select, insert, update, delete on table public.backlog_features to authenticated;

revoke all on function public.validate_backlog_hierarchy() from public, anon, authenticated;
revoke all on function public.sync_backlog_feature_epic_to_stories() from public, anon, authenticated;
revoke all on function public.prevent_linked_backlog_feature_delete() from public, anon, authenticated;

comment on function public.prevent_linked_backlog_feature_delete() is
  'Impede exclusao de feature com historias vinculadas; desvinculacao deve ser explicita.';
